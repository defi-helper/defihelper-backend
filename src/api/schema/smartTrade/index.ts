import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql';
import { Request } from 'express';
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-errors';
import { BigNumber as BN } from 'bignumber.js';
import container from '@container';
import {
  CallData,
  HandlerType,
  MockCallData,
  OrderCallHistory,
  OrderCallStatus,
  Order,
  OrderStatus,
  smartTradeOrderTableName,
  SwapCallData,
  OrderTokenLinkType as OrderTokenLinkTypeNative,
  OrderTokenLink,
} from '@models/SmartTrade/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { TokenCreatedBy } from '@models/Token/Entity';
import {
  UuidType,
  DateTimeType,
  PaginateList,
  SortArgument,
  PaginationArgument,
  onlyAllowed,
  EthereumAddressType,
  EthereumTransactionHashType,
  BigNumberType,
} from '../types';
import { WalletBlockchainType } from '../user';
import { TokenType } from '../token';

export const OrderCallHistoryStatusEnum = new GraphQLEnumType({
  name: 'SmartTradeOrderCallHistoryStatusEnum',
  values: Object.values(OrderCallStatus).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const OrderCallHistoryType = new GraphQLObjectType<OrderCallHistory>({
  name: 'SmartTradeOrderCallHistoryType',
  fields: {
    transaction: {
      type: EthereumTransactionHashType,
    },
    status: {
      type: GraphQLNonNull(OrderCallHistoryStatusEnum),
    },
    errorReason: {
      type: GraphQLNonNull(GraphQLString),
      resolve: ({ error }) => error,
    },
  },
});

export const OrderTokenLinkTypeEnum = new GraphQLEnumType({
  name: 'SmartTradeOrderTokenLinkTypeEnum',
  values: Object.values(OrderTokenLinkTypeNative).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const OrderTokenLinkType = new GraphQLObjectType<OrderTokenLink, Request>({
  name: 'SmartTradeOrderTokenLinkType',
  fields: {
    token: {
      type: GraphQLNonNull(TokenType),
      resolve: ({ token }, args, { dataLoader }) => {
        return dataLoader.token().load(token);
      },
    },
    type: {
      type: GraphQLNonNull(OrderTokenLinkTypeEnum),
    },
  },
});

export const OrderStatusEnum = new GraphQLEnumType({
  name: 'SmartTradeOrderStatusEnum',
  values: Object.values(OrderStatus).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const OrderHandlerTypeEnum = new GraphQLEnumType({
  name: 'SmartTradeOrderHandlerTypeEnum',
  values: Object.values(HandlerType).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const MockHandlerCallDataType = new GraphQLObjectType<MockCallData>({
  name: 'SmartTradeMockHandlerCallDataType',
  fields: {
    tokenIn: {
      type: GraphQLNonNull(EthereumAddressType),
      resolve: ({ callData: { tokenIn } }) => tokenIn,
    },
    tokenOut: {
      type: GraphQLNonNull(EthereumAddressType),
      resolve: ({ callData: { tokenOut } }) => tokenOut,
    },
    amountIn: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountIn } }) => amountIn,
    },
    amountOut: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountOut } }) => amountOut,
    },
  },
});

export const SwapHandlerCallDataRouteType = new GraphQLObjectType({
  name: 'SwapHandlerCallDataRouteType',
  fields: {
    amountOut: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ amountOut, decimals }) => new BN(amountOut).div(`1e${decimals}`),
    },
    amountOutMin: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ amountOutMin, decimals }) => new BN(amountOutMin).div(`1e${decimals}`),
    },
    slippage: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const SwapHandlerCallDataType = new GraphQLObjectType<SwapCallData>({
  name: 'SmartTradeSwapHandlerCallDataType',
  fields: {
    exchange: {
      type: GraphQLNonNull(EthereumAddressType),
      resolve: ({ callData: { exchange } }) => exchange,
    },
    path: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EthereumAddressType))),
      resolve: ({ callData: { path } }) => path,
    },
    amountIn: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountIn, tokenInDecimals } }) =>
        new BN(amountIn).div(`1e${tokenInDecimals}`),
    },
    boughtPrice: {
      type: BigNumberType,
      resolve: ({ callData: { boughtPrice } }) => boughtPrice,
    },
    stopLoss: {
      type: SwapHandlerCallDataRouteType,
      resolve: ({ callData: { routes, tokenOutDecimals } }) => {
        if (routes[0] === null) return null;

        return {
          amountOut: routes[0].amountOut,
          amountOutMin: routes[0].amountOutMin,
          slippage: routes[0].slippage,
          decimals: tokenOutDecimals,
        };
      },
    },
    takeProfit: {
      type: SwapHandlerCallDataRouteType,
      resolve: ({ callData: { routes, tokenOutDecimals } }) => {
        if (routes[1] === null) return null;

        return {
          amountOut: routes[1].amountOut,
          amountOutMin: routes[1].amountOutMin,
          slippage: routes[1].slippage,
          decimals: tokenOutDecimals,
        };
      },
    },
    deadline: {
      type: GraphQLNonNull(GraphQLInt),
      resolve: ({ callData: { deadline } }) => deadline,
    },
  },
});

export const CallDataType = new GraphQLUnionType({
  name: 'SmartTradeOrderCallDataType',
  types: [MockHandlerCallDataType, SwapHandlerCallDataType],
  resolveType: (order: CallData) => {
    if (order.type === HandlerType.MockHandler) {
      return MockHandlerCallDataType;
    }
    if (order.type === HandlerType.SwapHandler) {
      return SwapHandlerCallDataType;
    }
    throw new Error(`Invalid handler type "${JSON.stringify(order)}"`);
  },
});

export const OrderType = new GraphQLObjectType<Order, Request>({
  name: 'SmartTradeOrderType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    number: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Order number',
    },
    owner: {
      type: GraphQLNonNull(WalletBlockchainType),
      description: 'Owner wallet',
      resolve: ({ owner }, args, { dataLoader }) => {
        return dataLoader.wallet().load(owner);
      },
    },
    handler: {
      type: GraphQLNonNull(EthereumAddressType),
      description: 'Handler contract address',
    },
    callData: {
      type: GraphQLNonNull(CallDataType),
      description: 'Handler call data',
      resolve: (order) => ({ type: order.type, callData: order.callData }),
    },
    status: {
      type: GraphQLNonNull(OrderStatusEnum),
      description: 'Status',
    },
    tx: {
      type: GraphQLNonNull(EthereumTransactionHashType),
      description: 'Transaction hash',
    },
    lastCall: {
      type: OrderCallHistoryType,
      resolve: ({ id }) => {
        return container.model
          .smartTradeOrderCallHistoryTable()
          .where('order', id)
          .orderBy('createdAt', 'desc')
          .first();
      },
    },
    tokens: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(OrderTokenLinkType))),
      resolve: (order) => {
        return container.model.smartTradeOrderTokenLinkTable().where('order', order.id);
      },
    },
    confirmed: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is order confirmed on blockchain',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const OrderListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('SmartTradeOrderListQuery', GraphQLNonNull(OrderType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'SmartTradeOrderListFilterInputType',
        fields: {
          my: {
            type: GraphQLBoolean,
          },
          network: {
            type: GraphQLString,
          },
          owner: {
            type: UuidType,
          },
          type: {
            type: GraphQLList(GraphQLNonNull(OrderHandlerTypeEnum)),
          },
          status: {
            type: GraphQLList(GraphQLNonNull(OrderStatusEnum)),
          },
          confirmed: {
            type: GraphQLBoolean,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'SmartTradeOrderListSortInputType',
      ['id', 'createdAt'],
      [{ column: 'createdAt', order: 'asc' }],
    ),
    pagination: PaginationArgument('SmartTradeOrderListPaginationInputType'),
  },
  resolve: onlyAllowed(
    'smartTradeOrder.list-own',
    async (root, { filter, sort, pagination }, { acl, currentUser }) => {
      if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

      const select = container.model
        .smartTradeOrderTable()
        .innerJoin(walletTableName, `${smartTradeOrderTableName}.owner`, `${walletTableName}.id`)
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where(function () {
          const { my, owner, network, status, type, confirmed } = filter;
          if (typeof my === 'boolean' && my === true) {
            this.where(`${walletTableName}.user`, currentUser.id);
          }
          if (owner !== undefined) {
            if (!acl.isAllowed('smartTradeOrder', 'list')) {
              throw new ForbiddenError('FORBIDDEN');
            }
            this.where(`${walletTableName}.user`, owner);
          }
          if (network !== undefined) {
            this.where(`${walletBlockchainTableName}.network`, network);
          }
          if (typeof confirmed === 'boolean') {
            this.where(`${smartTradeOrderTableName}.confirmed`, confirmed);
          }
          if (Array.isArray(type) && type.length > 0) {
            this.whereIn(`${smartTradeOrderTableName}.type`, type);
          }
          if (Array.isArray(status) && status.length > 0) {
            this.whereIn(`${smartTradeOrderTableName}.status`, status);
          }
        });

      return {
        list: await select
          .clone()
          .columns(`${smartTradeOrderTableName}.*`)
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset),
        pagination: {
          count: await select.clone().countDistinct(`${smartTradeOrderTableName}.id`).first(),
        },
      };
    },
  ),
};

export const OrderCancelMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(OrderType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('smartTradeOrder.cancel-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const order = await container.model.smartTradeOrderTable().where('id', id).first();
    if (!order) throw new UserInputError('Order not found');

    const ownerWallet = await container.model.walletTable().where('id', order.owner).first();
    if (!ownerWallet) throw new UserInputError('Owner wallet not found');
    if (ownerWallet.user !== currentUser.id) throw new UserInputError('Foreign order');

    return container.model.smartTradeService().updateOrder({
      ...order,
      status: OrderStatus.Canceled,
    });
  }),
};

export const SwapOrderCallDataTakeProfitInputType = new GraphQLInputObjectType({
  name: 'SwapOrderCallDataTakeProfitInputType',
  fields: {
    amountOut: {
      type: GraphQLNonNull(BigNumberType),
    },
    amountOutMin: {
      type: GraphQLNonNull(BigNumberType),
    },
    slippage: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const SwapOrderCallDataStopLossInputType = new GraphQLInputObjectType({
  name: 'SwapOrderCallDataStopLossInputType',
  fields: {
    amountOut: {
      type: GraphQLNonNull(BigNumberType),
    },
    amountOutMin: {
      type: GraphQLNonNull(BigNumberType),
    },
    moving: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    slippage: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const SwapOrderCreateInputType = new GraphQLInputObjectType({
  name: 'SmartTradeSwapOrderCreateInputType',
  fields: {
    number: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Order identificator',
    },
    owner: {
      type: GraphQLNonNull(UuidType),
      description: 'Owner wallet',
    },
    handler: {
      type: GraphQLNonNull(EthereumAddressType),
      description: 'Handler contract address',
    },
    callDataRaw: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Handler raw call data',
    },
    callData: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'SmartTradeSwapOrderCreateCallDataInputType',
          fields: {
            exchange: {
              type: GraphQLNonNull(EthereumAddressType),
            },
            pair: {
              type: GraphQLNonNull(EthereumAddressType),
            },
            path: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EthereumAddressType))),
            },
            tokenInDecimals: {
              type: GraphQLNonNull(GraphQLInt),
            },
            tokenOutDecimals: {
              type: GraphQLNonNull(GraphQLInt),
            },
            amountIn: {
              type: GraphQLNonNull(BigNumberType),
            },
            amountOut: {
              type: GraphQLNonNull(BigNumberType),
            },
            boughtPrice: {
              type: BigNumberType,
            },
            stopLoss: {
              type: SwapOrderCallDataStopLossInputType,
            },
            takeProfit: {
              type: SwapOrderCallDataTakeProfitInputType,
            },
            deadline: {
              type: GraphQLNonNull(GraphQLInt),
              description: 'Deadline seconds',
            },
          },
        }),
      ),
    },
    tx: {
      type: GraphQLNonNull(EthereumTransactionHashType),
      description: 'Transaction hash',
    },
  },
});

async function orderTokenLink(network: string, tokenAddress: string) {
  let token = await container.model
    .tokenTable()
    .where('blockchain', 'ethereum')
    .where('network', network)
    .where('address', tokenAddress.toLowerCase())
    .first();
  if (!token) {
    token = await container.model
      .tokenService()
      .create(
        null,
        'ethereum',
        network,
        tokenAddress.toLowerCase(),
        '',
        '',
        0,
        TokenCreatedBy.SmartTrade,
        null,
      );
  }
  return token;
}

export const SwapOrderCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(OrderType),
  args: {
    input: {
      type: GraphQLNonNull(SwapOrderCreateInputType),
    },
  },
  resolve: onlyAllowed('smartTradeOrder.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { number, owner, handler, callDataRaw, callData, tx } = input;
    const duplicate = await container.model.smartTradeOrderTable().where({ owner, number }).first();
    if (duplicate) {
      return duplicate;
    }
    const ownerWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletTableName}.id`,
        `${walletBlockchainTableName}.id`,
      )
      .where(`${walletTableName}.id`, owner)
      .first();
    if (!ownerWallet) {
      throw new UserInputError('Owner wallet not found');
    }

    const smartTradeService = container.model.smartTradeService();
    const order = await smartTradeService.createOrder(
      number,
      ownerWallet,
      handler.toLowerCase(),
      callDataRaw,
      {
        type: HandlerType.SwapHandler,
        callData: {
          exchange: callData.exchange,
          pair: callData.pair,
          path: callData.path,
          tokenInDecimals: callData.tokenInDecimals,
          tokenOutDecimals: callData.tokenOutDecimals,
          amountIn: callData.amountIn.toFixed(0),
          boughtPrice: callData.boughtPrice ? callData.boughtPrice.toString(10) : null,
          routes: [
            callData.stopLoss
              ? {
                  amountOut: callData.stopLoss.amountOut.toFixed(0),
                  amountOutMin: callData.stopLoss.amountOutMin.toFixed(0),
                  moving: callData.stopLoss.moving
                    ? callData.amountOut.minus(callData.stopLoss.amountOut).toFixed(0)
                    : null,
                  slippage: callData.stopLoss.slippage.toString(),
                  direction: 'lt',
                }
              : null,
            callData.takeProfit
              ? {
                  amountOut: callData.takeProfit.amountOut.toFixed(0),
                  amountOutMin: callData.takeProfit.amountOutMin.toFixed(0),
                  moving: null,
                  slippage: callData.takeProfit.slippage.toString(),
                  direction: 'gt',
                }
              : null,
          ],
          deadline: callData.deadline,
        },
      },
      OrderStatus.Pending,
      tx,
      false,
    );
    await smartTradeService.tokenLink(
      order,
      await Promise.all([
        orderTokenLink(ownerWallet.network, callData.path[0]).then((token) => ({
          token,
          type: OrderTokenLinkTypeNative.In,
        })),
        orderTokenLink(ownerWallet.network, callData.path[1]).then((token) => ({
          token,
          type: OrderTokenLinkTypeNative.Out,
        })),
      ]),
    );

    return order;
  }),
};
