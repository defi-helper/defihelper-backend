import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';

export interface Params {
  id: string;
}

export interface MoralisTokenPrice {
  nativePrice?: {
    value: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  usdPrice: number;
  tokenAddress: string;
  exchangeAddress?: string;
  exchangeName?: string;
  symbol: unknown;
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
      throw new Error('unsupported network');
  }

  const moralis = await container.moralis().getWeb3API();
  const walletMetrics = container.model.metricService();
  const tokensBalances = await moralis.account.getTokenBalances({
    chain,
    address: wallet.address,
  });

  const tokensPrices = (await Promise.all(
    tokensBalances.map(
      (token) =>
        new Promise((resolve) => {
          moralis.token
            .getTokenPrice({
              chain,
              address: token.token_address,
            })
            .then((resolvedTokensInfo) =>
              resolve({
                ...resolvedTokensInfo,
                tokenAddress: token.token_address,
              }),
            )
            .catch(() => resolve(null));
        }),
    ),
  )) as (MoralisTokenPrice | null)[];

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
        return (
          t && (t.tokenAddress || '').toLowerCase() === tokenBalance.token_address.toLowerCase()
        );
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
          .where('symbol', tokenBalance.symbol)
          .first();

        if (!tokenRecordAlias) {
          tokenRecordAlias = await container.model
            .tokenAliasService()
            .create(tokenBalance.name, tokenBalance.symbol, false, tokenBalance.thumbnail || null);
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
          );
      }

      const totalTokenNumber = new BN(tokenBalance.balance).div(`1e${tokenBalance.decimals}`);
      const totalTokensUSDPrice = new BN(tokenPrice.usdPrice).multipliedBy(totalTokenNumber);

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

  return process.done();
};
