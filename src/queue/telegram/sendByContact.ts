import { Process } from '@models/Queue/Entity';
import container from '@container';
import { TelegramTemplate } from '@services/Telegram';

export interface TelegramNotification {
  contactId: string;
  template: TelegramTemplate;
  params: Object;
}

const debugTelegramContact = 'ad068a6f-d1b3-4634-a649-d20f68f25b32';
export default async (process: Process) => {
  const { template, params, contactId } = process.task.params as TelegramNotification;

  const debugCondition = template === 'automationsMigrableContracts';

  let contact;
  if (debugCondition) {
    contact = await container.model.userContactTable().where('id', debugTelegramContact).first();
  } else contact = await container.model.userContactTable().where('id', contactId).first();

  if (!contact) {
    throw new Error(`Contact not found, condition is ${debugCondition ? 'debug' : 'regular'}`);
  }

  if (!contact.params?.chatId) {
    throw new Error(`Incorrect chatId: ${contact.params?.chatId}`);
  }

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  try {
    await container.telegram().send(
      template,
      {
        ...container.template.i18n(container.i18n.byLocale(user.locale)),
        ...params,
      },
      Number(contact.params.chatId),
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
