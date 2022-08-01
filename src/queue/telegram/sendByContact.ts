import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TelegramTemplate } from '@services/Telegram';
import { tableName as userTableName } from '@models/User/Entity';
import { userContactTableName } from '@models/Notification/Entity';

export interface TelegramNotification {
  contactId: string;
  template: TelegramTemplate;
  params: Object;
}

export default async (process: Process) => {
  const { template, params, contactId } = process.task.params as TelegramNotification;
  const contact = await container.model
    .userContactTable()
    .column(`${userContactTableName}.*`)
    .column(`${userTableName}.locale`)
    .innerJoin(userTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .where(`${userContactTableName}.id`, contactId)
    .first();

  if (!contact) {
    throw new Error('Contact not found');
  }

  if (!contact.params?.chatId) {
    throw new Error(`Incorrect chatId: ${contact.params?.chatId}`);
  }

  try {
    await container.telegram().send(
      template,
      {
        ...container.template.i18n(container.i18n.byLocale(contact.locale)),
        ...params,
      },
      contact.params.chatId,
    );
  } catch (error: any) {
    if (error?.response?.statusCode === 403) {
      await container.model.userContactService().deactivate(contact);
      return process.done().info('Target contact deactivated due to dialog blocking');
    }

    throw error;
  }

  return process.done();
};
