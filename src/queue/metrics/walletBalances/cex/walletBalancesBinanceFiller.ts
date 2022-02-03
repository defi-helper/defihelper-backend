import container from '@container';
import { Process } from '@models/Queue/Entity';
import Binance, { AssetBalance } from 'binance-api-node';
import {
  Wallet,
  WalletExchange,
  walletExchangeTableName,
  WalletSuspenseReason,
  walletTableName,
} from '@models/Wallet/Entity';
import BN from 'bignumber.js';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const walletMetrics = container.model.metricService();
  const exchangeWallet: Wallet & WalletExchange = await container.model
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
    if (e.message !== 'Invalid API-key, IP, or permissions for action.') {
      throw e;
    }

    await container.model
      .walletService()
      .suspense(exchangeWallet.id, WalletSuspenseReason.CexUnableToAuthorize);

    return process.done();
  }

  const resolveTokenPrice = (symbol: string) => {
    // || stablecoin
    return ['USDT', 'BUSD'].map((bridge) => prices[symbol + bridge]).find((v) => v) || 1;
  };
  const assetsOnBalance = spotAssetsList
    .filter((v) => !new BN(v.free).plus(v.locked).isZero())
    .map((v) => {
      const bridgedPrice = resolveTokenPrice(v.asset);

      return {
        symbol: v.asset,
        amountTokens: new BN(v.free).plus(v.locked).toString(10),
        amountUSD: new BN(v.free).plus(v.locked).multipliedBy(bridgedPrice).toString(10),
      };
    });
  const existingTokens = await container.model
    .tokenTable()
    .distinctOn('symbol')
    .whereIn(
      'symbol',
      assetsOnBalance.map((v) => v.symbol),
    );

  const aggregatedAssetsList = assetsOnBalance
    .map((v) => ({
      ...v,
      existingToken: existingTokens.find((eToken) => eToken.symbol === v.symbol),
    }))
    .filter((v) => v.existingToken);

  await Promise.all(
    aggregatedAssetsList.map((v) => {
      if (!v.existingToken) return null;

      return walletMetrics.createToken(
        null,
        exchangeWallet,
        v.existingToken,
        {
          usd: v.amountUSD,
          balance: v.amountTokens,
        },
        new Date(),
      );
    }),
  );

  return process
    .done()
    .info(assetsOnBalance.length > aggregatedAssetsList.length ? "some tokens didn't found" : '');
};
