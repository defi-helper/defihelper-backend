import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  if (container.parent.log.chatId === 0) return process.done();

  const errors = await container.model
    .logTable()
    .whereIn('source', ['queue:metricsContractCurrent', 'queue:metricsWalletCurrent'])
    .andWhereBetween('createdAt', [dayjs().add(-10, 'minutes').toDate(), new Date()])
    .andWhere('message', 'like', '%Price for%');
  const telegramService = container.telegram();
  await Promise.all(
    errors.map(({ source, message }) =>
      telegramService.send('log', { source, message }, container.parent.log.chatId),
    ),
  );

  return process.done();
};
