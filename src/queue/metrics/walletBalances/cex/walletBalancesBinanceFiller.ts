import container from '@container';
import { Process } from '@models/Queue/Entity';
import Binance, { AssetBalance } from 'binance-api-node';
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
  const binance = Binance({
    apiKey: keyPair?.apiKey,
    apiSecret: keyPair?.apiSecret,
  });

  let spotAssetsList: AssetBalance[];
  let prices: { [key: string]: string };
  try {
    spotAssetsList = (await binance.accountInfo()).balances;
    prices = await binance.prices();
  } catch (e) {
    if (!(e instanceof Error) || e.message !== 'Invalid API-key, IP, or permissions for action.') {
      throw e;
    }

    await container.model
      .walletService()
      .suspense(exchangeWallet.id, WalletSuspenseReason.CexUnableToAuthorize);

    return process.done();
  }

  const resolveTokenPrice = (symbol: string) => {
    return ['USDT', 'BUSD'].map((bridge) => prices[symbol + bridge]).find((v) => v) || 1;
  };

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

  const assetsOnBalance = spotAssetsList
    .filter(({ asset, free, locked }) => {
      const metricBalance = walletTokenBalances.get(asset);

      return !new BN(free).plus(locked).isZero() || (metricBalance && metricBalance !== '0');
    })
    .map(({ asset, free, locked }) => {
      const bridgedPrice = resolveTokenPrice(asset);

      return {
        symbol: asset,
        balance: new BN(free).plus(locked).toString(10),
        usd: new BN(free).plus(locked).multipliedBy(bridgedPrice).toString(10),
      };
    });

  const existingTokens = await container.model
    .tokenTable()
    .distinctOn('symbol')
    .whereIn(
      'symbol',
      assetsOnBalance.map(({ symbol }) => symbol),
    )
    .then((rows) => new Map(rows.map((token) => [token.symbol, token])));

  const { found, notFound } = assetsOnBalance.reduce<{
    found: Array<{ symbol: string; balance: string; usd: string; token: Token }>;
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
    found.map(({ token, balance, usd }) =>
      walletMetrics.createToken(
        null,
        exchangeWallet,
        token,
        {
          usd,
          balance,
        },
        new Date(),
      ),
    ),
  );

  return process
    .done()
    .info(notFound.length > 0 ? `tokens "${notFound.join(', ')}" didn't found` : '');
};
