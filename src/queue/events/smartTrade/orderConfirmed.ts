import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType, Order, OrderStatus } from '@models/SmartTrade/Entity';
import UniswapPairABI from '@models/SmartTrade/data/uniswapPairABI.json';

async function registerWatcher(order: Order) {
  if (order.status !== OrderStatus.Pending) return order;

  if (order.type === HandlerType.SwapHandler) {
    const scanner = container.scanner();
    const listener = await scanner.registerListener(
      await scanner.registerContract(order.network, order.callData.pair, UniswapPairABI),
      'Sync',
      { promptly: {} },
    );
    return container.model.smartTradeService().updateOrder({
      ...order,
      watcherListenerId: listener.id,
    });
  }

  return order;
}

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const queue = container.model.queueService();
  let order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }

  if (order.statusTask === null) {
    order = await container.model.smartTradeService().updateOrder({
      ...order,
      statusTask: await queue
        .push('smartTradeOrderStatusResolve', { id: order.id })
        .then((task) => task.id),
    });
  }
  if (order.watcherListenerId === null) {
    order = await registerWatcher(order);
  }

  return process.done();
};
