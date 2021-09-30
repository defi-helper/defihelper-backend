import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('automateTriggerByTime', { type: TriggerType.EveryMonth }),
    queue.push('metricsContractScannerBroker', {
      dateFrom: dayjs().add(-1, 'month').startOf('month').unix(),
      dateTo: dayjs().startOf('month').unix(),
    }),
  ]);

  return process.done();
};
