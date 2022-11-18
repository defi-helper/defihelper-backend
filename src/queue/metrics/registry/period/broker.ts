import container from '@container';
import { Process } from '@models/Queue/Entity';

interface Params {
  date: string;
  period: 'day' | 'week' | 'month';
}

export default async (process: Process) => {
  const { date, period } = process.task.params as Params;

  const queue = container.model.queueService();
  await Promise.all([
    queue.push(
      'metricsContractRegistryPeriodFiller',
      {
        date,
        period,
      },
      { priority: 6 },
    ),
    queue.push(
      'metricsTokenRegistryPeriodFiller',
      {
        date,
        period,
      },
      { priority: 6 },
    ),
    queue.push(
      'metricsWalletRegistryPeriodFiller',
      {
        date,
        period,
      },
      { priority: 6 },
    ),
    queue.push(
      'metricsWalletTokenRegistryPeriodFiller',
      {
        date,
        period,
      },
      { priority: 6 },
    ),
  ]);

  return process.done();
};
