import container from '@container';
import { Process } from '@models/Queue/Entity';
import { getActionHandler, getConditionHandler, triggerTableName } from '@models/Automate/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const automateService = container.model.automateService();
  const trigger = await automateService
    .triggerTable()
    .innerJoin(walletTableName, `${walletTableName}.id`, `${triggerTableName}.wallet`)
    .where('id', id)
    .andWhere('active', true)
    .andWhere(`${walletTableName}.isLowBalance`, false)
    .first();
  if (!trigger) throw new Error('Trigger not found');

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
          throw new Error(`Condition "${condition.id}": ${e instanceof Error ? e.stack : e}`);
        }
      }, Promise.resolve(true));

      if (conditionsCheck === false) {
        throw new Error('conditions check failed');
      }
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
          throw new Error(`Action "${action.id}": ${e instanceof Error ? e.stack : e}`);
        }
      }, Promise.resolve(null));

      await automateService.createTriggerCallHistory(trigger);
      await automateService.updateTrigger({
        ...trigger,
        lastCallAt: new Date(),
      });
    }
  } catch (e) {
    await automateService.incrementTriggerRetries(trigger);
    await automateService.createTriggerCallHistory(
      trigger,
      e instanceof Error ? e : new Error(`${e}`),
    );

    return process.info(`crashed, retry #${trigger.retries}`).done();
  }

  await automateService.resetTriggerRetries(trigger);
  return process.done();
};
