import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Emitter } from '@services/Event';
import container from '@container';
import { Wallet, WalletBlockchain } from '@models/Wallet/Entity';
import { Token } from '@models/Token/Entity';
import {
  CallData,
  HandlerType,
  Order,
  OrderCallHistory,
  OrderCallStatus,
  OrderStatus,
  OrderTokenLink,
  OrderTokenLinkType,
  SmartTradeOrderCallHistoryTable,
  SmartTradeOrderTable,
  SmartTradeOrderTokenLinkTable,
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

  public readonly onOrderUpdated = new Emitter<Readonly<Order>>((order) => {
    container.cache().publish(
      'defihelper:channel:onSmartTradeOrderStatusChanged',
      JSON.stringify({
        id: order.id,
        owner: order.owner,
        type: order.type,
        status: order.status,
      }),
    );
  });

  public readonly onOrderCallTxCreated = new Emitter<
    Readonly<{ order: Order; call: OrderCallHistory }>
  >(({ call }) => {
    container.model.queueService().push('eventsSmartTradeOrderCallTxCreated', { id: call.id });
  });

  constructor(
    public readonly orderTable: Factory<SmartTradeOrderTable>,
    public readonly orderTokenLinkTable: Factory<SmartTradeOrderTokenLinkTable>,
    public readonly orderCallHistoryTable: Factory<SmartTradeOrderCallHistoryTable>,
  ) {}

  async createOrder(
    number: string,
    owner: Wallet & WalletBlockchain,
    handler: string,
    callDataRaw: string,
    callData: CallData,
    status: OrderStatus,
    active: boolean,
    tx: string,
    confirmed: boolean,
  ) {
    const created: Order = {
      id: uuid(),
      number,
      owner: owner.id,
      handler,
      callDataRaw,
      ...callData,
      balances: {},
      status,
      active,
      tx,
      confirmed,
      claim: false,
      statusTask: null,
      watcherListenerId: null,
      checkTaskId: null,
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
    this.onOrderUpdated.emit(updated);

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

  async tokenLink(order: Order, links: Array<{ token: Token; type: OrderTokenLinkType }>) {
    const created = links.map(
      ({ token, type }): OrderTokenLink => ({
        id: uuid(),
        order: order.id,
        token: token.id,
        type,
        createdAt: new Date(),
      }),
    );

    await Promise.all(
      created.map((link) =>
        this.orderTokenLinkTable().insert(link).onConflict(['order', 'token', 'type']).ignore(),
      ),
    );
    return created;
  }
}
