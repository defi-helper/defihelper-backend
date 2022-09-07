import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import BN from 'bignumber.js';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .distinctOn(`${walletBlockchainTableName}.address`)
    .column(`${walletBlockchainTableName}.id`)
    .column(`${walletTableName}.id as userId`)
    .column(`${userTableName}.createdAt as registeredAt`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .innerJoin(userTableName, `${walletTableName}.user`, `${userTableName}.id`)
    .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum')
    .whereNull(`${walletTableName}.deletedAt`);

  const contactsCount = await container.model
    .userContactTable()
    .column('user')
    .count('id')
    .groupBy('user')
    .then((rows) => new Map(rows.map((row) => [row.user, row.count])));

  const lag = 600 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, { id, userId, registeredAt }) => {
    const startAt = await prev;

    const contractsCount = new BN(contactsCount.get(userId) ?? 0);

    if (contractsCount.isZero() && dayjs().diff(dayjs(registeredAt), 'day', true) > 30) {
      return startAt;
    }

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
