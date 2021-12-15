import { Process } from '@models/Queue/Entity';
import container from '@container';
import { Role, tableName as userTableName } from '@models/User/Entity';
import { ContactBroker, userContactTableName } from '@models/Notification/Entity';

export default async (process: Process) => {
  const contacts = await container.model
    .userContactTable()
    .columns({
      [userContactTableName]: `${userContactTableName}.*`,
      locale: `${userTableName}.locale`,
    })
    .innerJoin(userTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .where(`${userTableName}.role`, Role.Candidate)
    .andWhere('broker', ContactBroker.Telegram);

  await Promise.all(
    contacts.map((contact) => {
      if (!contact.params?.chatId) {
        return null;
      }

      return container.model.queueService().push('sendTelegram', {
        chatId: contact.params.chatId,
        locale: contact.locale,
        template: 'publicBetaStarted',
      });
    }),
  );

  await container.model.userTable().where('role', Role.Candidate).update('role', Role.User);
  return process.done();
};
