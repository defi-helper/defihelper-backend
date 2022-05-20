import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id: user } = process.task.params as Params;

  const wallets = await container.model.walletTable().where({ user });
  const queue = container.model.queueService();

  await Promise.all(
    wallets.map(({ id }) => {
      return Promise.all([
        queue.push(
          'metricsWalletBalancesDeBankFiller',
          {
            id,
          },
          {
            priority: 9,
          },
        ),
        queue.push(
          'metricsWalletProtocolsBalancesDeBankFiller',
          {
            id,
          },
          {
            priority: 9,
          },
        ),
      ]);
    }),
  );

  return process.done();
};
