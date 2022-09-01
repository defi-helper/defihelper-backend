import container from '@container';
import { Process, TaskStatus } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  if (container.parent.log.chatId === 0) return process.done();

  const stuckedTasks = await container.model
    .queueTable()
    .where('status', TaskStatus.Process)
    .andWhere('scanner', true)
    .andWhere('updatedAt', '<=', dayjs().add(-1, 'hour').toDate());

  if (stuckedTasks.length === 0) return process.done();

  const representation = stuckedTasks.map((t) => `${t.id}(${t.handler})`).join(', ');
  await container
    .telegram()
    .send(
      'log',
      { source: 'Some scanner tasks looks stucked!', message: representation },
      container.parent.log.chatId,
    );

  return process.done();
};
