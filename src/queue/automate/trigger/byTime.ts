import container from '@container';
import { TriggerType, triggerTableName } from '@models/Automate/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

interface Params {
  type: TriggerType;
}

export default async (process: Process) => {
  const { type } = process.task.params as Params;

  const triggers = await container.model
    .automateTriggerTable()
    .columns(`${triggerTableName}.*`)
    .innerJoin(walletTableName, `${walletTableName}.id`, `${triggerTableName}.wallet`)
    .where(`${triggerTableName}.active`, true)
    .andWhere(`${triggerTableName}.type`, type)
    .whereNull(`${walletTableName}.deletedAt`)
    .orderBy(`${triggerTableName}.id`, 'asc');
  const lag = 3600 / triggers.length;
  const queue = container.model.queueService();
  await triggers.reduce<Promise<dayjs.Dayjs>>(async (prev, { id }) => {
    const startAt = await prev;
    await queue.push('automateTriggerRun', { id }, { startAt: startAt.toDate(), topic: 'trigger' });

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
