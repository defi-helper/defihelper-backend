import container from '@container';
import { Process, Task } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

interface Params {
  userId: string;
}

export default async (process: Process) => {
  const { userId } = process.task.params as Params;

  const user = await container.model.userTable().where('id', userId).first();
  if (!user) throw new Error('User not found');

  const queue = container.model.queueService();
  const wallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .andWhere(`${walletTableName}.user`, user.id)
    .andWhere(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum')
    .whereNull(`${walletTableName}.deletedAt`);

  await wallets.reduce<Promise<Task[]>>(async (addedTasksPromise, wallet) => {
    const addedTasks = await addedTasksPromise;
    if (container.blockchain.ethereum.byNetwork(wallet.network).testnet) return addedTasks;

    return [
      ...addedTasks,
      await queue.push('metricsWalletBalancesDeBankFiller', {
        id: wallet.id,
      }),
    ];
  }, Promise.resolve([]));

  return process.done();
};
