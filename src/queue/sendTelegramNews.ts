import container from '@container';
import { ContactBroker, ContactStatus, userContactTableName } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const contacts = await container.model
    .userContactTable()
    .where({
      status: ContactStatus.Active,
      broker: ContactBroker.Telegram,
    })
    .groupByRaw(`${userContactTableName}.params->>'chatId', ${userContactTableName}.id`);

  const lag = 3600 / contacts.length;
  await contacts.reduce<Promise<dayjs.Dayjs>>(async (prev, contact) => {
    const startAt = await prev;

    if (contact.params?.chatId) {
      await container.model.queueService().push(
        'sendTelegram',
        {
          chatId: contact.params.chatId,
          template: 'goodNews',
          params: {},
          locale: 'enUS',
        },
        { startAt: startAt.toDate() },
      );
    }

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
