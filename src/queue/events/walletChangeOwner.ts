import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
  prevOwner: string;
}

export default async (process: Process) => {
  const { id, prevOwner } = process.task.params as Params;
  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');

  const user = await container.model.userTable().where('id', prevOwner).first();
  if (!user) throw new Error('Prev owner not found');

  const userBlockchainWallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.user`, prevOwner);
  if (userBlockchainWallets.length === 0) {
    await Promise.all([
      container.model.walletTable().update('user', blockchainWallet.user).where('user', user.id),
      container.model
        .userContactTable()
        .update('user', blockchainWallet.user)
        .where('user', user.id),
      container.model.voteTable().update('user', blockchainWallet.user).where('user', user.id),
      container.model
        .protocolUserFavoriteTable()
        .update('user', blockchainWallet.user)
        .where('user', user.id),
    ]);

    await container.model.userService().delete(user);
  }

  return process.done();
};
