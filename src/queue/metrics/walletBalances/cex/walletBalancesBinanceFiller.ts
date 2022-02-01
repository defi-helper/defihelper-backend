import container from '@container';
import { Process } from '@models/Queue/Entity';
import Binance, { AssetBalance } from 'binance-api-node';
import { WalletSuspenseReason } from '@models/Wallet/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const exchangeWallet = await container.model.walletExchangeTable().where('id', id).first();

  if (!exchangeWallet) {
    throw new Error('wallet not found');
  }

  const keyPair = container.cryptography().decryptJson(exchangeWallet.payload);

  const binance = Binance({
    apiKey: keyPair?.apiKey,
    apiSecret: keyPair?.apiSecret,
  });

  let spotAssetsList: AssetBalance[];
  try {
    spotAssetsList = (await binance.accountInfo()).balances;
  } catch (e) {
    await container.model
      .walletService()
      .suspense(exchangeWallet.id, WalletSuspenseReason.CexUnableToAuthorize);

    console.warn(e);

    return process.error(e).info('Wallet freezed');
  }

  console.warn(spotAssetsList);

  return process.done();
};
