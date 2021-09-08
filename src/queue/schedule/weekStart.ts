import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([queue.push('automateTriggerByTime', { type: TriggerType.EveryWeek })]);

  return process.done();
};
