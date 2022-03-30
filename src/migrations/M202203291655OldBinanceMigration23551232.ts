import container from '@container';
import {
  walletExchangeTableName,
  WalletExchangeType,
  walletTableName,
} from '@models/Wallet/Entity';

export default async () => {
  const wallets = await container.model
    .walletTable()
    .select(`${walletTableName}.*`)
    .innerJoin(walletExchangeTableName, `${walletExchangeTableName}.id`, `${walletTableName}.id`)
    .andWhere(`${walletExchangeTableName}.exchange`, WalletExchangeType.Binance);

  const walletsExchange = await container.model.walletExchangeTable().whereIn(
    'id',
    wallets.map(({ id }) => id),
  );

  return await Promise.all(
    wallets.map((wallet) => {
      const walletExchange = walletsExchange.find((v) => v.id === wallet.id);
      if (!walletExchange) {
        throw new Error('wallet exchange must be found here');
      }

      const keyPair = container.cryptography().decryptJson(walletExchange.payload);
      if (!keyPair.apiKey || !keyPair.apiSecret) return null;

      return container.model.walletService().updateExchangeWallet(wallet, {
        ...walletExchange,
        payload: container.cryptography().encryptJson({
          apiKey: keyPair.apiKey,
          secret: keyPair.apiSecret,
        }),
      });
    }),
  );
};
