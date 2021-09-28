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

  try {
    const conditions = await automateService
      .conditionTable()
      .where('trigger', trigger.id)
      .orderBy('priority', 'asc');
    if (conditions.length > 0) {
      const conditionsCheck = await conditions.reduce(async (prev, condition) => {
        if (!(await prev)) return false;

        try {
          return await getConditionHandler(condition).call(null, condition.params);
        } catch (e) {
          throw new Error(`Condition "${condition.id}": ${e.stack}`);
        }
      }, Promise.resolve(true));
      if (conditionsCheck === false) return process.done();
    }

    const actions = await automateService
      .actionTable()
      .where('trigger', trigger.id)
      .orderBy('priority', 'asc');
    if (actions.length > 0) {
      await actions.reduce(async (prev, action) => {
        await prev;

        try {
          return await Promise.resolve(getActionHandler(action).call(null, action.params));
        } catch (e) {
          throw new Error(`Action "${action.id}": ${e.stack}`);
        }
      }, Promise.resolve(null));

      await automateService.createTriggerCallHistory(trigger);
      await automateService.updateTrigger({
        ...trigger,
        lastCallAt: new Date(),
      });
    }
  } catch (e) {
    await automateService.createTriggerCallHistory(trigger, e);
  }

  return process.done();
};
