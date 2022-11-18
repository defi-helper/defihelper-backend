import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('metricsRegistryPeriodBroker', {
      date: dayjs().add(-1, 'month').startOf('month').toString(),
      period: 'month',
    }),
    queue.push('automateTriggerByTime', { type: TriggerType.EveryMonth }),
  ]);

  return process.done();
};
