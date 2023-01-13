import container from '@container';
import {
  ContractStopLossStatus,
  contractStopLossTableName,
  contractTableName,
} from '@models/Automate/Entity';
import { Process, TaskStatus } from '@models/Queue/Entity';

export default async (process: Process) => {
  const candidates = await container.model
    .automateContractStopLossTable()
    .columns(`${contractStopLossTableName}.*`)
    .innerJoin(
      contractTableName,
      `${contractStopLossTableName}.contract`,
      `${contractTableName}.id`,
    )
    .where('status', ContractStopLossStatus.Pending)
    .whereNull(`${contractTableName}.archivedAt`)
    .whereNull(`${contractTableName}.blockedAt`);

  const automateService = container.model.automateService();
  const queue = container.model.queueService();
  await Promise.all(
    candidates.map(async (stopLoss) => {
      let task;
      if (stopLoss.task) {
        task = await queue.queueTable().where('id', stopLoss.task).first();
        if (task) {
          if ([TaskStatus.Pending, TaskStatus.Process].includes(task.status)) return null;
          return queue.resetAndRestart(task);
        }
      }
      task = await queue.push(
        'automateContractStopLossRun',
        { id: stopLoss.id },
        { topic: 'trigger' },
      );
      return automateService.updateStopLoss({
        ...stopLoss,
        task: task.id,
      });
    }),
  );

  return process.done();
};
