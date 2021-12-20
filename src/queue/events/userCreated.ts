import container from '@container';
import { Process } from '@models/Queue/Entity';
import { ProductCode } from '@models/Store/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';
import { WalletType } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const user = await container.model.userTable().where('id', id).first();
  if (!user) throw new Error('User not found');

  // Collect assets data
  const wallets = await container.model
    .walletTable()
    .where('type', WalletType.Wallet)
    .andWhere('blockchain', 'ethereum')
    .andWhere('user', user.id);

  await Promise.all(
    wallets.map((wallet) =>
      container.model.queueService().push('metricsMoralisWalletBalancesFiller', {
        id: wallet.id,
      }),
    ),
  );

  // Free notifications
  const notificationProduct = await container.model
    .storeProductTable()
    .where({
      code: ProductCode.Notification,
      amount: 100,
    })
    .first();
  if (notificationProduct) {
    const firstWallet = await container.model.walletTable().where('user', user.id).first();
    if (firstWallet) {
      await container.model
        .storeService()
        .purchase(
          notificationProduct,
          firstWallet.blockchain,
          firstWallet.network,
          firstWallet.address,
          notificationProduct.amount,
          '',
          new Date(),
        );
    }
  }

  // Enable all notifications
  await Promise.all(
    Object.values(UserNotificationType).map((t) =>
      container.model.userNotificationService().enable(user, t as UserNotificationType),
    ),
  );

  return process.done();
};
