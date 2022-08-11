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
import { AuthenticationError, ForbiddenError } from 'apollo-server-errors';
import { BigNumber as BN } from 'bignumber.js';
import container from '@container';
import {
  CallData,
  HandlerType,
  MockCallData,
  Order,
  OrderStatus,
  smartTradeOrderTableName,
  SwapCallData,
} from '@models/SmartTrade/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
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

export const SwapHandlerCallDataDirectionEnum = new GraphQLEnumType({
  name: 'SwapHandlerCallDataDirectionEnum',
  values: {
    gt: { value: 'gt', description: 'Take profit' },
    lt: { value: 'lt', description: 'Stop loss' },
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
    direction: {
      type: GraphQLNonNull(SwapHandlerCallDataDirectionEnum),
      resolve: ({ callData: { direction } }) => direction,
    },
    amountIn: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountIn, tokenInDecimals } }) =>
        new BN(amountIn).div(`1e${tokenInDecimals}`),
    },
    amountOut: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountOut, tokenOutDecimals } }) =>
        new BN(amountOut).div(`1e${tokenOutDecimals}`),
    },
    amountOutMin: {
      type: GraphQLNonNull(BigNumberType),
      resolve: ({ callData: { amountOutMin, tokenOutDecimals } }) =>
        new BN(amountOutMin).div(`1e${tokenOutDecimals}`),
    },
    slippage: {
      type: GraphQLFloat,
      resolve: ({ callData: { slippage } }) => slippage,
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

export const OrderType = new GraphQLObjectType<Order>({
  name: 'SmartTradeOrderType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    network: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Blockchain network id',
    },
    number: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Order number',
    },
    owner: {
      type: GraphQLNonNull(EthereumAddressType),
      description: 'Owner address',
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
        .innerJoin(walletBlockchainTableName, function () {
          this.on(`${walletBlockchainTableName}.network`, `${smartTradeOrderTableName}.network`);
          this.on(`${walletBlockchainTableName}.address`, `${smartTradeOrderTableName}.owner`);
        })
        .innerJoin(walletTableName, `${walletBlockchainTableName}.id`, `${walletTableName}.id`)
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
            this.where(`${smartTradeOrderTableName}.network`, network);
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

export const SwapOrderCreateInputType = new GraphQLInputObjectType({
  name: 'SmartTradeSwapOrderCreateInputType',
  fields: {
    network: {
      type: GraphQLNonNull(GraphQLString),
    },
    number: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Order identificator',
    },
    owner: {
      type: GraphQLNonNull(EthereumAddressType),
      description: 'Owner wallet address',
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
            amountIn: {
              type: GraphQLNonNull(BigNumberType),
            },
            tokenOutDecimals: {
              type: GraphQLNonNull(GraphQLInt),
            },
            amountOut: {
              type: GraphQLNonNull(BigNumberType),
            },
            amountOutMin: {
              type: GraphQLNonNull(BigNumberType),
            },
            slippage: {
              type: GraphQLNonNull(GraphQLFloat),
            },
            direction: {
              type: GraphQLNonNull(SwapHandlerCallDataDirectionEnum),
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

export const SwapOrderCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(OrderType),
  args: {
    input: {
      type: GraphQLNonNull(SwapOrderCreateInputType),
    },
  },
  resolve: onlyAllowed('smartTradeOrder.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { network, number, owner, handler, callDataRaw, callData, tx } = input;
    const duplicate = await container.model
      .smartTradeOrderTable()
      .where({ blockchain: 'ethereum', network, number })
      .first();
    if (duplicate) {
      return duplicate;
    }

    return container.model.smartTradeService().createOrder(
      'ethereum',
      network,
      number,
      owner.toLowerCase(),
      handler.toLowerCase(),
      callDataRaw,
      {
        type: HandlerType.SwapHandler,
        callData: {
          ...callData,
          amountIn: callData.amountIn.toString(10),
          amountOut: callData.amountOut.toString(10),
          amountOutMin: callData.amountOutMin.toString(10),
        },
      },
      OrderStatus.Pending,
      tx,
      false,
    );
  }),
};
