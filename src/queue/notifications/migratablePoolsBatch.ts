import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus, userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';
import {
  ContractBlockchainType,
  contractMigratableRemindersBulkTableName,
  contractTableName,
} from '@models/Protocol/Entity';
import { metricWalletRegistryTableName } from '@models/Metric/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export default async (process: Process) => {
  const notifications = await container.model
    .contractMigratableRemindersBulkTable()
    .column(`${walletTableName}.id as walletId`)
    .column(`${walletTableName}.address as walletAddress`)
    .column(`${walletTableName}.user as userId`)
    .column(`${contractTableName}.*`)
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
    .where(`${contractMigratableRemindersBulkTableName}.processed`, false)
    .groupBy(`${userTableName}.id`);
  let usersIds: string[] = [];
  const candidates: {
    [userId: string]: {
      [walletId: string]: (ContractBlockchainType & { userId: string })[];
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

    if (!candidates[notification.userId]) {
      candidates[notification.walletId] = [];
    }

    const target = contracts.find((v) => v.id === notification.id);
    if (!target) {
      throw new Error(`No contract found`);
    }
    candidates[notification.walletId] = [...candidates[notification.walletId], target];
    usersIds = [...usersIds, notification.userId];
  });

  const contacts = await container.model
    .userContactTable()
    .whereIn('user', usersIds)
    .andWhere('broker', ContactBroker.Telegram);
  const users = await Promise.all(
    Object.entries(candidates).map(async ([walletId, contracts]) => {
      if (!contracts.length) {
        return null;
      }
      const { userId } = contracts[0];
      const targetContacts = contacts.find((v) => v.id === userId);

      Promise.all(
        contacts.map((contact) => {
          return container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'automateNotEnoughFunds',
            params: {
              visualizedWalletAddress: `${notifyBy.walletAddress.slice(
                0,
                6,
              )}...${notifyBy.walletAddress.slice(-4)}(${
                container.blockchain.ethereum.byNetwork(notifyBy.walletNetwork).name
              })`,
            },
          });
        }),
      );
    }),
  );

  return process.done();
};
