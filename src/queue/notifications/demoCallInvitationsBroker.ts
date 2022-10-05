import { Process } from '@models/Queue/Entity';
import container from '@container';
import { tableName as userTableName } from '@models/User/Entity';
import { userContactTableName } from '@models/Notification/Entity';

export default async (process: Process) => {
  const contacts = await container.model
    .userTable()
    .column(`${userContactTableName}.user`)
    .column(`${userContactTableName}.id`)
    .innerJoin(userContactTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .whereRaw(`(CURRENT_TIMESTAMP::date - "${userTableName}"."createdAt"::date) = 14`)
    .groupBy(`${userContactTableName}.user`);

  await Promise.all(
    contacts.map((contact) =>
      container.model.queueService().push('sendTelegramByContact', {
        contactId: contact.id,
        template: 'demoCallInvite',
      }),
    ),
  );

  return process.done();
};
