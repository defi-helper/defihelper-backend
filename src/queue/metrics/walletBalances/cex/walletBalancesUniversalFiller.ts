import container from '@container';
import { Process } from '@models/Queue/Entity';
import ccxt, { AuthenticationError } from 'ccxt';
import {
  walletExchangeTableName,
  WalletSuspenseReason,
  walletTableName,
} from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import { MetricWalletToken, metricWalletTokenRegistryTableName } from '@models/Metric/Entity';
import { Token, tokenTableName } from '@models/Token/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const walletMetrics = container.model.metricService();
  const exchangeWallet = await container.model
    .walletTable()
    .innerJoin(walletExchangeTableName, `${walletExchangeTableName}.id`, `${walletTableName}.id`)
    .where(`${walletTableName}.id`, id)
    .first();

  if (!exchangeWallet) {
    throw new Error('wallet not found');
  }

  const keyPair = container.cryptography().decryptJson(exchangeWallet.payload);
  const exchangeInstance = new ccxt[exchangeWallet.exchange]({
    ...keyPair,

    options: {
      adjustForTimeDifference: true,
    },
  });

  const database = container.database();
  const walletTokenBalances = await container.model
    .metricWalletTokenRegistryTable()
    .column(`${tokenTableName}.symbol AS token`)
    .column(
      database.raw(`(${metricWalletTokenRegistryTableName}.data->>'balance')::numeric AS balance`),
    )
    .innerJoin(
      tokenTableName,
      `${metricWalletTokenRegistryTableName}.token`,
      `${tokenTableName}.id`,
    )
    .where(`${metricWalletTokenRegistryTableName}.wallet`, exchangeWallet.id)
    .then((rows) =>
      rows.reduce((map, { token, balance }) => {
        const prev = map.get(token) ?? '0';
        map.set(token, new BN(prev).plus(balance).toString(10));
        return map;
      }, new Map()),
    );

  let assetsOnBalance: { amount: BN; symbol: string; amountUsd: BN }[];
  try {
    const tokensPrices = Object.values(await exchangeInstance.fetchTickers()).map((v) => {
      return {
        symbol: v.symbol,
        price: new BN(v.ask ?? v.last ?? v.average),
      };
    });
    const resolveTokenPriceUSD = (symbol: string): BN => {
      const tokenPrices = [
        tokensPrices.find((v) => v.symbol === `${symbol}/USDT`)?.price,
        tokensPrices.find((v) => v.symbol === `${symbol}/BUSD`)?.price,
        tokensPrices.find((v) => v.symbol === `${symbol}/USD`)?.price,
      ].filter((v) => v && !v.isZero());

      return tokenPrices[0] ?? new BN(1);
    };

    assetsOnBalance = Object.entries((await exchangeInstance.fetchBalance()).total)
      .map(([symbol, amount]) => ({ symbol, amount: new BN(amount) }))
      .filter(({ amount, symbol }) => {
        const metricBalance = walletTokenBalances.get(symbol);

        return !amount.isZero() || (metricBalance && metricBalance !== '0');
      })
      .map((token) => ({
        ...token,
        amountUsd: token.amount.multipliedBy(resolveTokenPriceUSD(token.symbol)),
      }));
  } catch (e) {
    if (e instanceof AuthenticationError) {
      await container.model
        .walletService()
        .suspense(exchangeWallet.id, WalletSuspenseReason.CexUnableToAuthorize);
      return process.done();
    }

    return process.error(e instanceof Error ? e : new Error(`${e}`));
  }

  const existingTokens = await container.model
    .tokenTable()
    .distinctOn('symbol')
    .columns('*')
    .whereIn(
      'symbol',
      assetsOnBalance.map(({ symbol }) => symbol),
    )
    .orderBy('symbol', 'asc')
    .orderBy('createdAt', 'asc')
    .then((rows) => new Map(rows.map((token) => [token.symbol, token])));

  const { found, notFound } = assetsOnBalance.reduce<{
    found: Array<{ symbol: string; amount: BN; amountUsd: BN; token: Token }>;
    notFound: string[];
  }>(
    (result, v) => {
      const token = existingTokens.get(v.symbol);
      if (!token) {
        return { found: result.found, notFound: [...result.notFound, v.symbol] };
      }

      return { notFound: result.notFound, found: [...result.found, { ...v, token }] };
    },
    { found: [], notFound: [] },
  );

  await found.reduce<Promise<MetricWalletToken | null>>(
    async (prev, { token, amount, amountUsd }) => {
      await prev;

      return walletMetrics.createWalletToken(
        null,
        exchangeWallet,
        token,
        {
          usd: amountUsd.toString(10),
          balance: amount.toString(10),
        },
        new Date(),
      );
    },
    Promise.resolve(null),
  );

  return process
    .done()
    .info(notFound.length > 0 ? `tokens "${notFound.join(', ')}" didn't found` : '');
};
