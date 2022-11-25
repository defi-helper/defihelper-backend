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
      closed: false,
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

  async updateOrder(order: Order, state: Partial<Order<any>>) {
    await this.orderTable().where('id', order.id).update(state);

    const updated: Order = {
      ...order,
      ...state,
      updatedAt: new Date(),
    };
    this.onOrderUpdated.emit(updated);

    return updated;
  }

  async confirm(order: Order) {
    if (order.confirmed) return order;

    const updated = await this.updateOrder(order, {
      confirmed: true,
    });
    this.onOrderConfirmed.emit(updated);

    return updated;
  }

  process(order: Order, tx: string, closed: boolean) {
    return Promise.all([
      this.createCall(order, tx),
      this.updateOrder(order, {
        status: OrderStatus.Processed,
        closed,
      }),
    ]);
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
      const call: OrderCallHistory = {
        id: uuid(),
        order: order.id,
        tx: null,
        error: tx.toString(),
        status: OrderCallStatus.Error,
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      await this.orderCallHistoryTable().insert(call);
      return call;
    }

    return this.process(order, tx.hash, false).then(([created]) => created);
  }

  async createCall(order: Order, tx: string) {
    const created: OrderCallHistory = {
      id: uuid(),
      order: order.id,
      tx,
      error: '',
      status: OrderCallStatus.Pending,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.orderCallHistoryTable().insert(created);
    this.onOrderCallTxCreated.emit({ order, call: created });

    return created;
  }

  async updateCall(
    call: OrderCallHistory,
    state: Partial<OrderCallHistory>,
  ): Promise<OrderCallHistory> {
    await this.orderCallHistoryTable().where('id', call.id).update(state);

    return {
      ...call,
      ...state,
    };
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
