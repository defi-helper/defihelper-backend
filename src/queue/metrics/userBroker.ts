import dayjs from 'dayjs';
import container from '@container';
import { Process } from '@models/Queue/Entity';

interface Params {
  priority: number;
  notify: boolean;
}

export default async (process: Process) => {
  const { priority, notify } = process.task.params as Params;

  const queue = container.model.queueService();
  const ids = await container.model
    .userTable()
    .where('isMetricsTracked', true)
    .column('id')
    .orderBy('id');

  const lag = 86400 / ids.length;
  await ids.reduce<Promise<dayjs.Dayjs>>(async (prev, { id: userId }) => {
    const startAt = await prev;

    await queue.push(
      'metricsUserPortfolioFiller',
      { userId, priority, notify },
      { topic: 'metricCurrent', priority, startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
