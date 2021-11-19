import container from '@container';
import { Process, TaskStatus, Task } from '@models/Queue/Entity';

export default async (process: Process) => {
  if (container.parent.log.chatId === 0) return process.done();

  const targetHandlers: Array<Task['handler']> = [
    'billingTransferScan',
    'billingClaimScan',
    'billingStoreScan',
    'billingFeeOracle',
  ];
  const errorTasks = await container.model
    .queueTable()
    .whereIn('handler', targetHandlers)
    .andWhere('status', TaskStatus.Error);
  const telegramService = container.telegram();
  await Promise.all(
    errorTasks.map(({ id, handler, error }) => {
      return telegramService.send(
        'queueBillingError',
        {
          id,
          handler,
          error,
        },
        container.parent.log.chatId,
      );
    }),
  );

  return process.done();
};
