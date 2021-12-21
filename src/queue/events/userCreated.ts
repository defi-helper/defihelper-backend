import container from '@container';
import { Process } from '@models/Queue/Entity';
import { ProductCode } from '@models/Store/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';

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
