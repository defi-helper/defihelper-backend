import container from '@container';
import { Process, TaskStatus } from '@models/Queue/Entity';
import { OrderStatus } from '@models/SmartTrade/Entity';

export default async (process: Process) => {
  const orders = await container.model
    .smartTradeOrderTable()
    .where('status', OrderStatus.Pending)
    .where('confirmed', true);

  const smartTradeService = container.model.smartTradeService();
  const queue = container.model.queueService();
  await Promise.all(
    orders.map(async (order) => {
      let task;
      if (order.checkTaskId) {
        task = await queue.queueTable().where('id', order.checkTaskId).first();
        if (task) {
          if ([TaskStatus.Pending, TaskStatus.Process].includes(task.status)) return null;
          return queue.resetAndRestart(task);
        }
      }
      task = await queue.push('smartTradeOrderCheck', { id: order.id }, { topic: 'trigger' });

      return smartTradeService.updateOrder({
        ...order,
        checkTaskId: task.id,
      });
    }),
  );

  return process.done();
};
