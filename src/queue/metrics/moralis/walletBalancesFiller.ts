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
  exchangeAddress?: string;
  exchangeName?: string;
  symbol: unknown;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const wallet = await container.model.walletTable().where({ id }).first();
  const chain = 'eth';

  if (!wallet || wallet.blockchain !== 'ethereum') {
    throw new Error('wallet not found or unsupported blockchain');
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
            .then((v) => resolve(v))
            .catch(() => resolve(null));
        }),
    ),
  )) as (MoralisTokenPrice | null)[];

  const existingTokensRecords = await container.model
    .tokenTable()
    .whereIn(
      'address',
      tokensBalances.map((v) => v.token_address),
    )
    .andWhere('blockchain', wallet.blockchain)
    .andWhere('network', wallet.network);

  await Promise.all(
    tokensBalances.map(async (tokenBalance) => {
      const tokenPrice = tokensPrices.find(
        (t) => t && t.exchangeAddress === tokenBalance.token_address,
      );
      if (!tokenPrice) {
        return new Promise(() => {});
      }
      let tokenRecord = existingTokensRecords.find((t) => t.address === tokenBalance.token_address);
      if (!tokenRecord) {
        tokenRecord = await container.model
          .tokenService()
          .create(
            null,
            wallet.blockchain,
            wallet.network,
            tokenBalance.token_address,
            tokenBalance.name,
            tokenBalance.symbol,
            new BN(tokenBalance.decimals).toNumber(),
          );
      }

      const significand = new BN(10).pow(tokenBalance.decimals);
      const totalTokenNumber = new BN(tokenBalance.balance).dividedBy(significand);
      const totalTokenPrice = new BN(tokenPrice.usdPrice);

      return walletMetrics.createToken(
        null,
        wallet,
        tokenRecord,
        {
          usd: totalTokenPrice.toString(),
          balance: totalTokenNumber.toString(),
        },
        new Date(),
      );
    }),
  );

  return process.done();
};
