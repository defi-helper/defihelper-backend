import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, TokenCreatedBy, tokenTableName } from '@models/Token/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { metricWalletTokenTableName } from '@models/Metric/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
    .first();
  let chain: 'eth' | 'bsc' | 'avalanche' | 'polygon';

  if (!blockchainWallet || blockchainWallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
  }

  switch (blockchainWallet.network) {
    case '1':
      chain = 'eth';
      break;
    case '56':
      chain = 'bsc';
      break;
    case '137':
      chain = 'polygon';
      break;
    case '43114':
      chain = 'avalanche';
      break;
    default:
      throw new Error(`unsupported network: ${blockchainWallet.network}`);
  }

  const moralis = await container.moralis().getWeb3API();
  const walletMetrics = container.model.metricService();

  let tokensBalances = [];
  try {
    tokensBalances = await moralis.account.getTokenBalances({
      chain,
      address: blockchainWallet.address,
    });
  } catch (e) {
    if (e.code === 141) {
      return process.info(e.error).later(dayjs().add(3, 'minutes').toDate());
    }
    return process
      .info('Unable to resolve account`s tokens lists')
      .error(new Error(`${e.code}: ${e.error}`));
  }

  const tokensPrices = await tokensBalances.reduce<
    Promise<({ usd: string; address: string } | null)[]>
  >(async (result, token) => {
    return [
      ...(await result),
      await new Promise((resolve) => {
        container.blockchain.ethereum
          .byNetwork(blockchainWallet.network)
          .tokenPriceResolver.usd(token.token_address)
          .then((r) => resolve({ usd: r, address: token.token_address }))
          .catch(() => resolve(null));
      }),
    ];
  }, Promise.resolve([]));

  const existingTokensRecords = await container.model
    .tokenTable()
    .whereIn(
      'address',
      tokensBalances.map((v) => v.token_address.toLowerCase()),
    )
    .andWhere('blockchain', blockchainWallet.blockchain)
    .andWhere('network', blockchainWallet.network);

  const lastTokenMetrics = await container.model
    .metricWalletTokenTable()
    .distinctOn(`${metricWalletTokenTableName}.wallet`, `${metricWalletTokenTableName}.token`)
    .column(`${tokenTableName}.*`)
    .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
    .where(`${metricWalletTokenTableName}.wallet`, blockchainWallet.id)
    .orderBy(`${metricWalletTokenTableName}.wallet`)
    .orderBy(`${metricWalletTokenTableName}.token`)
    .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');

  const createdMetrics = await Promise.all(
    tokensBalances.map(async (tokenBalance) => {
      const tokenPrice = tokensPrices.find((t) => {
        return t && (t.address || '').toLowerCase() === tokenBalance.token_address.toLowerCase();
      });

      if (!tokenPrice) {
        return null;
      }
      let tokenRecord = existingTokensRecords.find(
        (t) => t.address.toLowerCase() === tokenBalance.token_address.toLowerCase(),
      );
      if (!tokenRecord) {
        let tokenRecordAlias = await container.model
          .tokenAliasTable()
          .where('name', 'ilike', tokenBalance.name)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(
              tokenBalance.name,
              tokenBalance.symbol,
              tokenBalance.thumbnail ? TokenAliasLiquidity.Unstable : TokenAliasLiquidity.Unknown,
              tokenBalance.thumbnail || null,
            );
        }

        tokenRecord = await container.model
          .tokenService()
          .create(
            tokenRecordAlias,
            blockchainWallet.blockchain,
            blockchainWallet.network,
            tokenBalance.token_address.toLowerCase(),
            tokenBalance.name,
            tokenBalance.symbol,
            new BN(tokenBalance.decimals).toNumber(),
            TokenCreatedBy.Scanner,
          );
      }

      const totalTokenNumber = new BN(tokenBalance.balance).div(`1e${tokenBalance.decimals}`);
      const totalTokensUSDPrice = new BN(tokenPrice.usd).multipliedBy(totalTokenNumber);

      return walletMetrics.createToken(
        null,
        blockchainWallet,
        tokenRecord,
        {
          usd: totalTokensUSDPrice.toString(10),
          balance: totalTokenNumber.toString(10),
        },
        new Date(),
      );
    }),
  );

  await Promise.all(
    lastTokenMetrics.map((v) => {
      if (createdMetrics.some((exstng) => exstng?.token === v.id)) {
        return null;
      }

      return walletMetrics.createToken(
        null,
        blockchainWallet,
        v,
        {
          usd: '0',
          balance: '0',
        },
        new Date(),
      );
    }),
  );

  let nativeBalance;
  const nativeTokenPrice = await container.blockchain.ethereum
    .byNetwork(blockchainWallet.network)
    .nativeTokenPrice();
  const { nativeTokenDetails } = container.blockchain.ethereum.byNetwork(blockchainWallet.network);
  try {
    nativeBalance = new BN(
      (
        await moralis.account.getNativeBalance({
          address: blockchainWallet.address,
          chain,
        })
      ).balance,
    ).div(`1e${nativeTokenDetails.decimals}`);
  } catch (e) {
    if (e.code === 141) {
      return process.info(e.error).later(dayjs().add(3, 'minutes').toDate());
    }
    return process.info(`No native balance: ${e.code}, ${e.error}`).done();
  }

  const nativeUSD = nativeBalance.multipliedBy(nativeTokenPrice);
  let nativeTokenRecord = await container.model
    .tokenTable()
    .where('address', '0x0000000000000000000000000000000000000000')
    .andWhere('blockchain', blockchainWallet.blockchain)
    .andWhere('network', blockchainWallet.network)
    .first();

  if (!nativeTokenRecord) {
    let nativeTokenAlias = await container.model
      .tokenAliasTable()
      .where('name', 'ilike', nativeTokenDetails.name)
      .first();

    if (!nativeTokenAlias) {
      nativeTokenAlias = await container.model
        .tokenAliasService()
        .create(
          nativeTokenDetails.name,
          nativeTokenDetails.symbol,
          TokenAliasLiquidity.Unstable,
          null,
        );
    }

    nativeTokenRecord = await container.model
      .tokenService()
      .create(
        nativeTokenAlias,
        blockchainWallet.blockchain,
        blockchainWallet.network,
        '0x0000000000000000000000000000000000000000',
        nativeTokenDetails.name,
        nativeTokenDetails.symbol,
        nativeTokenDetails.decimals,
        TokenCreatedBy.Scanner,
      );
  }

  await walletMetrics.createToken(
    null,
    blockchainWallet,
    nativeTokenRecord,
    {
      usd: nativeUSD.toString(10),
      balance: nativeBalance.toString(),
    },
    new Date(),
  );

  return process.done();
};
