import container from '@container';
import { Process } from '@models/Queue/Entity';
import { OrderStatus } from '@models/SmartTrade/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }
  if (order.status !== OrderStatus.Pending) {
    return process.done();
  }

  await container.model.smartTradeService().handle(order);

  return process.done();
};
