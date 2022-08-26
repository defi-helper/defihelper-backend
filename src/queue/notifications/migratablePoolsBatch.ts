import { Process } from '@models/Queue/Entity';
import container from '@container';
import { tableName as userTableName } from '@models/User/Entity';
import {
  contractMigratableRemindersBulkTableName,
  contractTableName,
} from '@models/Protocol/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const notifications = await container.model
    .contractMigratableRemindersBulkTable()
    .distinctOn(`${userTableName}.id`)
    .column(`${walletBlockchainTableName}.id as walletId`)
    .column(`${walletBlockchainTableName}.address as walletAddress`)
    .column(`${walletTableName}.user as userId`)
    .column(`${contractTableName}.*`)
    .innerJoin(
      walletTableName,
      `${walletTableName}.id`,
      `${contractMigratableRemindersBulkTableName}.wallet`,
    )
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${contractMigratableRemindersBulkTableName}.wallet`,
    )
    .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
    .innerJoin(
      contractTableName,
      `${contractTableName}.id`,
      `${contractMigratableRemindersBulkTableName}.contract`,
    )
    .where(`${contractMigratableRemindersBulkTableName}.processed`, false);

  let usersIds: string[] = [];
  const candidates: {
    [userId: string]: {
      [walletId: string]: string[];
    };
  } = {};

  const contracts = await container.model.contractBlockchainTable().whereIn(
    'id',
    notifications.map((v) => v.id),
  );

  notifications.forEach((notification) => {
    if (!candidates[notification.userId]) {
      candidates[notification.userId] = {};
    }

    if (!candidates[notification.userId][notification.walletId]) {
      candidates[notification.userId][notification.walletId] = [];
    }

    const target = contracts.find((v) => v.id === notification.id);
    if (!target) {
      throw new Error(`No contract found`);
    }
    candidates[notification.userId][notification.walletId] = [
      ...candidates[notification.userId][notification.walletId],
      target.id,
    ];
    usersIds = [...usersIds, notification.userId];
  });

  await Promise.all(
    Object.entries(candidates).map(async ([userId, wallets]) => {
      const walletsEntities = await container.model
        .walletBlockchainTable()
        .whereIn('id', Object.keys(wallets))
        .then((rows) => new Map(rows.map((row) => [row.id, row])));

      const items = Object.entries(wallets).reduce((prev, [walletId, contractsList]) => {
        const w = walletsEntities.get(walletId);
        if (!w) {
          throw new Error(`Wallets ${walletId} not found`);
        }
        return {
          ...prev,
          [w.id]: contractsList,
        };
      }, {});

      return container.model.queueService().push('migratablePoolsNotifyUser', {
        userId,
        payload: items,
      });
    }),
  );

  return process.done();
};
