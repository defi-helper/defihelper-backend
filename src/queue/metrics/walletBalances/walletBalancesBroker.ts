import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { WalletType } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .where('type', WalletType.Wallet)
    .andWhere('blockchain', 'ethereum')
    .andWhereNot('network', '1285');

  const lag = 86400 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;

    switch (wallet.network) {
      case '1285':
        await container.model.queueService().push(
          'metricsWalletBalancesDeBankFiller',
          {
            id: wallet.id,
          },
          { startAt: startAt.toDate() },
        );
        break;

      default:
        await container.model.queueService().push(
          'metricsWalletBalancesMoralisFiller',
          {
            id: wallet.id,
          },
          { startAt: startAt.toDate() },
        );
    }

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
