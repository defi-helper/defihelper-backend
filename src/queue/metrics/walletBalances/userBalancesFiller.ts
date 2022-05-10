import container from '@container';
import { Process, Task } from '@models/Queue/Entity';
import dayjs from 'dayjs';
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

  const tasks = await wallets.reduce<Promise<Task[]>>(async (addedTasksPromise, wallet) => {
    const addedTasks = await addedTasksPromise;
    return [
      ...addedTasks,
      await queue.push('metricsWalletBalancesDeBankFiller', {
        id: wallet.id,
      }),
    ];
  }, Promise.resolve([]));
  await queue.push(
    'notificationPortfolioMetricsNotify',
    {
      userId: user.id,
      wait: tasks.map(({ id }) => id),
    },
    {
      startAt: dayjs().add(5, 'minutes').toDate(),
    },
  );

  return process.done();
};
