import container from '@container';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, TokenCreatedBy } from '@models/Token/Entity';
import BN from 'bignumber.js';
import dayjs from 'dayjs';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const wallet = await container.model.walletTable().where({ id }).first();
  let chain: 'eth' | 'bsc' | 'avalanche' | 'polygon';

  if (!wallet || wallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
  }

  switch (wallet.network) {
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
      throw new Error(`unsupported network: ${wallet.network}`);
  }

  const moralis = await container.moralis().getWeb3API();
  const walletMetrics = container.model.metricService();

  let tokensBalances = [];
  try {
    tokensBalances = await moralis.account.getTokenBalances({
      chain,
      address: wallet.address,
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
          .byNetwork(wallet.network)
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
    .andWhere('blockchain', wallet.blockchain)
    .andWhere('network', wallet.network);

  await Promise.all(
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
              tokenBalance.thumbnail ? TokenAliasLiquidity.Unstable : TokenAliasLiquidity.Trash,
              tokenBalance.thumbnail || null,
            );
        }

        tokenRecord = await container.model
          .tokenService()
          .create(
            tokenRecordAlias,
            wallet.blockchain,
            wallet.network,
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
        wallet,
        tokenRecord,
        {
          usd: totalTokensUSDPrice.toString(10),
          balance: totalTokenNumber.toString(10),
        },
        new Date(),
      );
    }),
  );

  let nativeBalance;
  const nativeTokenPrice = await container.blockchain.ethereum
    .byNetwork(wallet.network)
    .nativeTokenPrice();
  const { nativeTokenDetails } = container.blockchain.ethereum.byNetwork(wallet.network);
  try {
    nativeBalance = new BN(
      (
        await moralis.account.getNativeBalance({
          address: wallet.address,
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
    .andWhere('blockchain', wallet.blockchain)
    .andWhere('network', wallet.network)
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
        wallet.blockchain,
        wallet.network,
        '0x0000000000000000000000000000000000000000',
        nativeTokenDetails.name,
        nativeTokenDetails.symbol,
        nativeTokenDetails.decimals,
        TokenCreatedBy.Scanner,
      );
  }

  await walletMetrics.createToken(
    null,
    wallet,
    nativeTokenRecord,
    {
      usd: nativeUSD.toString(10),
      balance: nativeBalance.toString(),
    },
    new Date(),
  );

  return process.done();
};
