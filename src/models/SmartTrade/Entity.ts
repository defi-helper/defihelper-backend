import { typedTableFactory } from '@services/Database';

export enum HandlerType {
  MockHandler = 'SmartTradeMockHandler',
  SwapHandler = 'SmartTradeSwapHandler',
}

export function isHandlerType(v: string): v is HandlerType {
  const types: string[] = Object.values(HandlerType);
  return types.includes(v);
}

export interface MockCallData {
  type: HandlerType.MockHandler;
  callData: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
  };
}

export interface SwapCallDataRoute {
  amountOut: string;
  amountOutMin: string;
  slippage: string;
  moving: string | null;
  direction: 'gt' | 'lt';
}

export interface SwapCallData {
  type: HandlerType.SwapHandler;
  callData: {
    exchange: string;
    pair: string;
    path: string[];
    tokenInDecimals: number;
    tokenOutDecimals: number;
    amountIn: string;
    boughtPrice: string | null;
    routes: Array<SwapCallDataRoute | null>;
    deadline: number;
  };
}

export type CallData = SwapCallData | MockCallData;

export enum OrderStatus {
  Pending = 'pending',
  Processed = 'processed',
  Succeeded = 'succeeded',
  Canceled = 'canceled',
}

export type OrderStatusRaw = '0' | '1' | '2';

export function orderStatusResolve(statusRaw: OrderStatusRaw) {
  return {
    '0': OrderStatus.Pending,
    '1': OrderStatus.Succeeded,
    '2': OrderStatus.Canceled,
  }[statusRaw];
}

export type Order<T extends CallData = CallData> = {
  id: string;
  number: string;
  owner: string;
  handler: string;
  callDataRaw: string;
  status: OrderStatus;
  tx: string;
  confirmed: boolean;
  claim: boolean;
  statusTask: string | null;
  watcherListenerId: string | null;
  checkTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & T;

export const smartTradeOrderTableName = 'smart_trade_order';

export const smartTradeOrderTableFactory = typedTableFactory(smartTradeOrderTableName);

export type SmartTradeOrderTable = ReturnType<ReturnType<typeof smartTradeOrderTableFactory>>;

export enum OrderTokenLinkType {
  In = 'in',
  Out = 'out',
}

export interface OrderTokenLink {
  id: string;
  order: string;
  token: string;
  type: OrderTokenLinkType;
  createdAt: Date;
}

export const smartTradeOrderTokenLinkTableName = 'smart_trade_order_token_link';

export const smartTradeOrderTokenLinkTableFactory = typedTableFactory(
  smartTradeOrderTokenLinkTableName,
);

export type SmartTradeOrderTokenLinkTable = ReturnType<
  ReturnType<typeof smartTradeOrderTokenLinkTableFactory>
>;

export enum OrderCallStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Error = 'error',
}

export interface OrderCallHistory {
  id: string;
  order: string;
  tx: string | null;
  status: OrderCallStatus;
  error: string;
  updatedAt: Date;
  createdAt: Date;
}

export const smartTradeOrderCallHistoryTableName = 'smart_trade_order_call_history';

export const smartTradeOrderCallHistoryTableFactory = typedTableFactory(
  smartTradeOrderCallHistoryTableName,
);

export type SmartTradeOrderCallHistoryTable = ReturnType<
  ReturnType<typeof smartTradeOrderCallHistoryTableFactory>
>;

declare module 'knex/types/tables' {
  interface Tables {
    [smartTradeOrderTableName]: Order;
    [smartTradeOrderTokenLinkTableName]: OrderTokenLink;
    [smartTradeOrderCallHistoryTableName]: OrderCallHistory;
  }
}
