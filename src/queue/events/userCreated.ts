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
      number: 0,
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

  const contacts = await container.model.userContactTable().where('user', user.id);
  await Promise.all(
    contacts.map((contact) =>
      Promise.all(
        Object.values(UserNotificationType).map((t) =>
          container.model
            .userNotificationService()
            .enable(contact, t as UserNotificationType, '12:00'),
        ),
      ),
    ),
  );

  return process.done();
};
