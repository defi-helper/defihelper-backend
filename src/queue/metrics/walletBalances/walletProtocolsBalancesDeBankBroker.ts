import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .distinctOn(`${walletBlockchainTableName}.address`)
    .column(`${walletBlockchainTableName}.id`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .innerJoin(userTableName, `${walletTableName}.user`, `${userTableName}.id`)
    .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum')
    .andWhere(`${userTableName}.isMetricsTracked`, true)
    .whereNull(`${walletTableName}.deletedAt`);

  const lag = 600 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, { id }) => {
    const startAt = await prev;

    await container.model
      .queueService()
      .push(
        'metricsWalletProtocolsBalancesDeBankFiller',
        { id },
        { topic: 'metricCurrent', startAt: startAt.toDate() },
      );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
