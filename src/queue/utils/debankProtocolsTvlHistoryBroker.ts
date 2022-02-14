import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const protocols = await container.model.protocolTable().where('adapter', 'debankByApiReadonly');

  const lag = 600 / protocols.length;
  await protocols.reduce<Promise<dayjs.Dayjs>>(async (prev, protocol) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'utilsDebankProtocolsTvlHistoryFiller',
      {
        id: protocol.id,
      },
      { startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
