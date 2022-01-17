import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
  prevOwner: string;
}

export default async (process: Process) => {
  const { id, prevOwner } = process.task.params as Params;
  const wallet = await container.model.walletTable().where('id', id).first();
  if (!wallet) throw new Error('Wallet not found');

  const user = await container.model.userTable().where('id', prevOwner).first();
  if (!user) throw new Error('Prev owner not found');

  const userWallets = await container.model.walletTable().where('user', prevOwner);
  if (userWallets.length === 0) {
    await Promise.all([
      container.model.userContactTable().update('user', wallet.user).where('user', user.id),
      container.model.voteTable().update('user', wallet.user).where('user', user.id),
      container.model
        .protocolUserFavoriteTable()
        .update('user', wallet.user)
        .where('user', user.id),
      container.model.userNotificationTable().update('user', wallet.user).where('user', user.id),
    ]);

    await container.model.userService().delete(user);
  }

  return process.done();
};
