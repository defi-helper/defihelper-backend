import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { WalletType } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .where('type', WalletType.Wallet)
    .andWhere('blockchain', 'ethereum');

  const lag = 86400 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;
    await container.model.queueService().push(
      'metricsMoralisWalletBalancesFiller',
      {
        id: wallet.id,
      },
      { startAt: startAt.toDate() },
    );
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
