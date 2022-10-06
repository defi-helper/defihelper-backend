import { Process } from '@models/Queue/Entity';
import container from '@container';
import { tableName as userTableName } from '@models/User/Entity';
import { ContactBroker, ContactStatus, userContactTableName } from '@models/Notification/Entity';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';

export default async (process: Process) => {
  const contacts = await container.model
    .userTable()
    .column(`${userContactTableName}.user`)
    .column(`${userContactTableName}.id`)
    .innerJoin(userContactTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .whereRaw(`(CURRENT_TIMESTAMP::date - "${userTableName}"."createdAt"::date) = 14`)
    .andWhere(`${userContactTableName}.broker`, ContactBroker.Telegram)
    .andWhere(`${userContactTableName}.status`, ContactStatus.Active);

  const contractsByUser = await container.model
    .walletTable()
    .column(`${walletTableName}.user`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .andWhere(`${walletBlockchainTableName}.type`, WalletBlockchainType.Contract)
    .groupBy(`${walletTableName}.user`)
    .then((rows) => new Set(rows.map((row) => [row.user, row])));

  await Promise.all(
    contacts.map((contact) => {
      if (contractsByUser.has(contact.user)) {
        return null;
      }

      return container.model.queueService().push('sendTelegramByContact', {
        contactId: contact.id,
        template: 'demoCallInvite',
      });
    }),
  );

  return process.done();
};
