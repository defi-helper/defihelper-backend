import container from '@container';
import { Process } from '@models/Queue/Entity';
import { ProductCode } from '@models/Store/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const user = await container.model.userTable().where('id', id).first();
  if (!user) throw new Error('User not found');

  // Free notifications
  const notificationProduct = await container.model
    .storeProductTable()
    .where({
      code: ProductCode.Notification,
      amount: 1000,
    })
    .first();
  if (notificationProduct) {
    const firstBlockchainWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.user`, user.id)
      .whereNull(`${walletTableName}.deletedAt`)
      .first();
    if (firstBlockchainWallet) {
      await container.model
        .storeService()
        .purchase(
          notificationProduct,
          firstBlockchainWallet.blockchain,
          firstBlockchainWallet.network,
          firstBlockchainWallet.address,
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
