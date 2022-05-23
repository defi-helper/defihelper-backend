import container from '@container';
import { Process } from '@models/Queue/Entity';
import ccxt, { AuthenticationError } from 'ccxt';
import {
  walletExchangeTableName,
  WalletSuspenseReason,
  walletTableName,
} from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
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
    .metricWalletTokenTable()
    .distinctOn(`${metricWalletTokenTableName}.wallet`, `${metricWalletTokenTableName}.token`)
    .column(`${tokenTableName}.symbol AS token`)
    .column(database.raw(`(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`))
    .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
    .where(`${metricWalletTokenTableName}.wallet`, exchangeWallet.id)
    .orderBy(`${metricWalletTokenTableName}.wallet`)
    .orderBy(`${metricWalletTokenTableName}.token`)
    .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
    .then((rows) => new Map(rows.map(({ token, balance }) => [token, balance])));

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

  await Promise.all(
    found.map(({ token, amount, amountUsd }) =>
      walletMetrics.createWalletToken(
        null,
        exchangeWallet,
        token,
        {
          usd: amountUsd.toString(10),
          balance: amount.toString(10),
        },
        new Date(),
      ),
    ),
  );

  return process
    .done()
    .info(notFound.length > 0 ? `tokens "${notFound.join(', ')}" didn't found` : '');
};
