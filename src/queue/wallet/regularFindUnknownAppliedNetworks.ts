import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .where('blockchain', 'ethereum')
    .distinctOn('address');

  const lag = 86400 / wallets.length; // seconds in day
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;
    await container.model.queueService().push(
      'findWalletAppliedNetworks',
      {
        walletId: wallet.id,
      },
      { startAt: startAt.toDate() },
    );
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
