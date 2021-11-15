import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('metricsContractBroker', {}),
    queue.push('metricsWalletBroker', {}),
    queue.push('automateTriggerByTime', { type: TriggerType.EveryHour }),
    queue.push('billingBroker', {}),
  ]);

  return process.done();
};
