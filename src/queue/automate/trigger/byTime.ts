import container from '@container';
import { TriggerType } from '@models/Automate/Entity';
import { Process } from '@models/Queue/Entity';

interface Params {
  type: TriggerType;
}

export default async (process: Process) => {
  const { type } = process.task.params as Params;

  const triggers = await container.model.automateTriggerTable().where({
    type,
    active: true,
  });
  const queue = container.model.queueService();
  await Promise.all(triggers.map(({ id }) => queue.push('automateTriggerRun', { id })));

  return process.done();
};
