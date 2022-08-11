import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType, OrderStatus } from '@models/SmartTrade/Entity';
import UniswapPairABI from '@models/SmartTrade/data/uniswapPairABI.json';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }
  if (order.watcherListenerId !== null || order.status !== OrderStatus.Pending) {
    return process.done();
  }

  if (order.type === HandlerType.SwapHandler) {
    const scanner = container.scanner();
    const listener = await scanner.registerListener(
      await scanner.registerContract(order.network, order.callData.pair, UniswapPairABI),
      'Sync',
      { promptly: {} },
    );
    await container.model.smartTradeService().updateOrder({
      ...order,
      watcherListenerId: listener.id,
    });

    return process.done();
  }

  return process.done();
};
