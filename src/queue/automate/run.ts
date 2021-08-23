import container from '@container';
import { Process } from '@models/Queue/Entity';
import { getActionHandler, getConditionHandler } from '@models/Automate/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const automateService = container.model.automateService();
  const trigger = await automateService.triggerTable().where('id', id).first();
  if (!trigger) throw new Error('Trigger not found');
  if (!trigger.active) return process.done();

  const conditions = await automateService
    .conditionTable()
    .where('trigger', trigger.id)
    .orderBy('priority', 'asc');
  if (conditions.length > 0) {
    const conditionsCheck = await conditions.reduce(
      async (prev, condition) =>
        (await prev) && getConditionHandler(condition).call(null, condition.params),
      Promise.resolve(true),
    );
    if (conditionsCheck === false) return process.done();
  }

  const actions = await automateService
    .actionTable()
    .where('trigger', trigger.id)
    .orderBy('priority', 'asc');
  if (actions.length > 0) {
    await actions.reduce(
      async (prev, action) => prev.then(() => getActionHandler(action).call(null, action.params)),
      Promise.resolve(null),
    );
  }

  await automateService.updateTrigger({
    ...trigger,
    lastCallAt: new Date(),
  });

  return process.done();
};
