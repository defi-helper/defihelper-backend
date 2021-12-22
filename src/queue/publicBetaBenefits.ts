import { Process } from '@models/Queue/Entity';
import container from '@container';
import { Role } from '@models/User/Entity';
import { ProductCode } from '@models/Store/Entity';

export default async (process: Process) => {
  const users = await container.model.userTable().where('role', Role.Candidate);
  const wallets = await container.model.walletTable().whereIn(
    'user',
    users.map((u) => u.id),
  );

  const notificationProduct = await container.model
    .storeProductTable()
    .where({
      code: ProductCode.Notification,
      amount: 1000,
    })
    .first();

  if (!notificationProduct) {
    throw new Error('create product first');
  }

  await Promise.all(
    users.map(async (user) => {
      const availableNotifications = await container.model
        .storeService()
        .availableNotifications(user);

      if (availableNotifications >= 1000) {
        return null;
      }

      const firstWallet = wallets.find((w) => w.user === user.id);
      if (firstWallet) {
        return container.model
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

      return null;
    }),
  );

  return process.done();
};
