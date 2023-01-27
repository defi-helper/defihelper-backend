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
  const isDebug = template === 'automationsMigrableContracts';

  const contact = await container.model
    .userContactTable()
    .where('id', isDebug ? debugTelegramContact : contactId)
    .first();
  if (!contact) {
    throw new Error(`Contact not found, condition is ${isDebug ? 'debug' : 'regular'}`);
  }
  if (!contact.params?.chatId) {
    throw new Error(`Incorrect chatId: ${contact.params?.chatId}`);
  }

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  try {
    await container.telegram().send(template, params, Number(contact.params.chatId));
  } catch (error: any) {
    if (error?.response?.error_code === 403) {
      await container.model.userContactService().deactivate(contact);
      return process.done().info('Target contact deactivated due to dialog blocking');
    }

    throw error;
  }

  await container.model.queueService().push('amplitudeLogEvent', {
    name: 'telegram_send_message_success',
    user: user.id,
  });

  return process.done();
};
