import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';

export interface Params {
  walletId: string;
}

export default async (process: Process) => {
  const contacts = await container.model.userContactTable().where({
    status: ContactStatus.Active,
    broker: ContactBroker.Telegram,
  });

  await Promise.all(
    contacts.map((contact) => {
      if (!contact.params?.chatId) return null;

      return container.model.queueService().push('sendTelegram', {
        chatId: contact.params.chatId,
        template: 'goodNews',
        params: {},
        locale: 'enUS',
      });
    }),
  );

  return process.done();
};
