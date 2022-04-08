import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const database = container.database();
  const contacts = await container.model
    .userContactTable()
    .distinct(database.raw(`params->>'chatId'`))
    .column('params')
    .where('status', ContactStatus.Active)
    .andWhere('broker', ContactBroker.Telegram)
    .andWhere(database.raw(`params->>'chatId' IS NOT NULL`))
    .then((rows) =>
      rows.map(({ params }) => params?.chatId).filter((v): v is string => v !== undefined),
    );

  const lag = 3600 / contacts.length;
  await contacts.reduce<Promise<dayjs.Dayjs>>(async (prev, chatId) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'sendTelegram',
      {
        chatId,
        template: 'goodNews',
        params: {},
        locale: 'enUS',
      },
      { startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
