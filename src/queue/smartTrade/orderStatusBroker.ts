import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const smartTradeService = container.model.smartTradeService();
  const candidates = await container.model.smartTradeOrderTable().whereNull('statusTask');
  await Promise.all(
    candidates.map(async (order) => {
      return smartTradeService.updateOrder({
        ...order,
        statusTask: await queue
          .push('smartTradeOrderStatusResolve', { id: order.id })
          .then(({ id }) => id),
      });
    }),
  );

  return process.done();
};
