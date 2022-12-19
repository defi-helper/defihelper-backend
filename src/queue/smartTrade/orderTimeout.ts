import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType, OrderStatus } from '@models/SmartTrade/Entity';
import { LogJsonMessage } from '@services/Log';

interface Params {
  order: string;
  route: number;
  enterAt: number;
}

export default async (process: Process) => {
  const { order: orderId, route: routeIndex, enterAt } = process.task.params as Params;
  const log = LogJsonMessage.debug({ source: 'smartTradeOrderTimeout', orderId });

  const order = await container.model.smartTradeOrderTable().where('id', orderId).first();
  if (!order) {
    throw new Error('Order not found');
  }
  if (order.status !== OrderStatus.Pending) {
    log.ex({ status: order.status }).send();
    return process.done();
  }
  if (order.type !== HandlerType.SwapHandler) {
    throw new Error('Invalid order type');
  }
  const { routes } = order.callData;
  const route = routes[routeIndex];
  if (!route || !route.timeout) {
    throw new Error('Route not found');
  }
  if (route.timeout.enterAt !== enterAt) {
    log.ex({ taskEnterAt: enterAt, orderEnterAt: route.timeout.enterAt }).send();
    return process.done();
  }

  await container.model.smartTradeService().handle(order);

  return process.done();
};
