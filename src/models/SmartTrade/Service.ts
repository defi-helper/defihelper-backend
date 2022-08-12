import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import container from '@container';
import {
  CallData,
  HandlerType,
  Order,
  OrderCallHistory,
  OrderCallStatus,
  OrderStatus,
  SmartTradeOrderCallHistoryTable,
  SmartTradeOrderTable,
} from './Entity';
import * as handlers from './handlers';

export class SmartTradeService {
  public readonly onOrderCreated = new Emitter<Readonly<Order>>((order) => {
    if (!order.confirmed) {
      container.model.queueService().push('smartTradeOrderConfirm', { id: order.id });
    }
  });

  public readonly onOrderConfirmed = new Emitter<Readonly<Order>>((order) => {
    container.model.queueService().push('eventsSmartTradeOrderConfirmed', { id: order.id });
  });

  public readonly onOrderCallTxCreated = new Emitter<
    Readonly<{ order: Order; call: OrderCallHistory }>
  >(({ call }) => {
    container.model.queueService().push('eventsSmartTradeOrderCallTxCreated', { id: call.id });
  });

  constructor(
    public readonly orderTable: Factory<SmartTradeOrderTable>,
    public readonly orderCallHistoryTable: Factory<SmartTradeOrderCallHistoryTable>,
  ) {}

  async createOrder(
    blockchain: Blockchain,
    network: string,
    number: string,
    owner: string,
    handler: string,
    callDataRaw: string,
    callData: CallData,
    status: OrderStatus,
    tx: string,
    confirmed: boolean,
  ) {
    const created: Order = {
      id: uuid(),
      blockchain,
      network,
      number,
      owner,
      handler,
      callDataRaw,
      ...callData,
      status,
      tx,
      confirmed,
      statusTask: null,
      watcherListenerId: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.orderTable().insert(created);
    this.onOrderCreated.emit(created);
    if (created.confirmed) {
      this.onOrderConfirmed.emit(created);
    }

    return created;
  }

  async updateOrder(order: Order) {
    const updated: Order = {
      ...order,
      updatedAt: new Date(),
    };
    await this.orderTable().where('id', order.id).update(updated);

    return updated;
  }

  async confirm(order: Order) {
    if (order.confirmed) return order;

    const updated = await this.updateOrder({
      ...order,
      confirmed: true,
    });
    this.onOrderConfirmed.emit(updated);

    return updated;
  }

  async handle(order: Order) {
    let tx;
    switch (order.type) {
      case HandlerType.MockHandler:
        tx = await handlers.mockHandler(order);
        break;
      case HandlerType.SwapHandler:
        tx = await handlers.swapHandler(order);
        break;
      default:
        return null;
    }

    if (tx === null) return null;
    if (tx instanceof Error) {
      return this.orderCallHistoryTable().insert({
        id: uuid(),
        order: order.id,
        tx: null,
        error: tx.toString(),
        status: OrderCallStatus.Error,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
    }

    const created: OrderCallHistory = {
      id: uuid(),
      order: order.id,
      tx: tx.hash,
      error: '',
      status: OrderCallStatus.Pending,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await Promise.all([
      this.updateOrder({
        ...order,
        status: OrderStatus.Processed,
      }),
      this.orderCallHistoryTable().insert(created),
    ]);
    this.onOrderCallTxCreated.emit({ order, call: created });

    return created;
  }

  async updateCall(call: OrderCallHistory) {
    const updated: OrderCallHistory = {
      ...call,
      updatedAt: new Date(),
    };
    await this.orderCallHistoryTable().where('id', call.id).update(updated);

    return updated;
  }
}
