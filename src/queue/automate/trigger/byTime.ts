import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

interface Params {
  type: TriggerType;
}

export default async (process: Process) => {
  const { type } = process.task.params as Params;

  const triggers = await container.model
    .automateTriggerTable()
    .where('active', true)
    .andWhere('type', type)
    .orderBy('id', 'asc');
  const lag = 3600 / triggers.length;
  const queue = container.model.queueService();
  await triggers.reduce<Promise<dayjs.Dayjs>>(async (prev, { id }) => {
    const startAt = await prev;
    await queue.push('automateTriggerRun', { id }, { startAt: startAt.toDate() });

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
