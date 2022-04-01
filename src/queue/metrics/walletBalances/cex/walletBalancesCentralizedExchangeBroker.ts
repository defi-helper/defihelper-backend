import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { walletTableName, walletExchangeTableName } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .innerJoin(walletExchangeTableName, `${walletExchangeTableName}.id`, `${walletTableName}.id`)
    .where(`${walletTableName}.suspendReason`, null);

  const lag = 1800 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'metricsWalletBalancesCexUniversalFiller',
      {
        id: wallet.id,
      },
      { startAt: startAt.toDate(), priority: 9 },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
