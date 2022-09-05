import dayjs from 'dayjs';
import { validate as isUuid } from 'uuid';
import BN from 'bignumber.js';
import { utils as ethersUtils } from 'ethers';
import * as Wallet from '@models/Wallet/Entity';
import {
  GraphQLError,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLString,
  GraphQLScalarType,
  GraphQLType,
  GraphQLEnumType,
  GraphQLInt,
  GraphQLList,
  GraphQLInputObjectType,
  GraphQLArgumentConfig,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
} from 'graphql';
import container from '@container';
import { Request } from 'express';
import { ForbiddenError } from 'apollo-server-express';
import { WalletExchangeType } from '@models/Wallet/Entity';

export class GraphQLParseError extends GraphQLError {
  constructor(type: string, value: any) {
    super(`Field parse error: value ${value} is a invalid ${type}`);
  }
}

export const PaginationType = new GraphQLObjectType<{ count: { count: number } | undefined }>({
  name: 'Pagination',
  fields: {
    count: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Count of list elements',
      resolve: ({ count: row }) => (row ? parseInt(row.count.toString(), 10) : 0),
    },
  },
});

export const PaginateList = (name: string, type: GraphQLType) =>
  new GraphQLObjectType({
    name,
    fields: {
      list: {
        type: GraphQLList(type),
        description: 'Elements',
      },
      pagination: {
        type: GraphQLNonNull(PaginationType),
      },
    },
  });

export const PaginationArgument = (name: string): GraphQLArgumentConfig => ({
  type: new GraphQLInputObjectType({
    name,
    fields: {
      limit: {
        type: GraphQLInt,
        description: 'Limit',
        defaultValue: 10,
      },
      offset: {
        type: GraphQLInt,
        description: 'Offset',
        defaultValue: 0,
      },
    },
  }),
  description: 'Pagination',
  defaultValue: {
    limit: 10,
    offset: 0,
  },
});

export const SortOrderEnum = new GraphQLEnumType({
  name: 'SortOrderEnum',
  values: {
    asc: {
      description: 'Ascending',
    },
    desc: {
      description: 'Descending',
    },
  },
});

export const SortArgument = (
  name: string,
  columns: string[],
  defaultValue: Array<{ column: string; order: 'asc' | 'desc' }> = [],
): GraphQLArgumentConfig => ({
  type: GraphQLList(
    GraphQLNonNull(
      new GraphQLInputObjectType({
        name,
        fields: {
          column: {
            type: GraphQLNonNull(
              new GraphQLEnumType({
                name: `${name}ColumnEnum`,
                values: columns.reduce(
                  (prev, column) => ({ ...prev, [column]: { value: column } }),
                  {},
                ),
              }),
            ),
          },
          order: {
            type: SortOrderEnum,
            defaultValue: 'asc',
          },
        },
      }),
    ),
  ),
  defaultValue,
});

export const DateTimeType = new GraphQLScalarType({
  name: 'DateTimeType',
  description: 'Date and time',
  parseValue: (value: string) => {
    const dateTime = dayjs(value);
    if (!dateTime.isValid()) throw new GraphQLParseError('DateTime', value);

    return dateTime;
  },
  serialize: (value: dayjs.Dayjs | Date) => {
    if (dayjs.isDayjs(value)) return value.toDate().toISOString();

    return value.toISOString();
  },
});

export const BigNumberType = new GraphQLScalarType({
  name: 'BigNumberType',
  description: 'Big number',
  parseValue: (value: string) => {
    const number = new BN(value);
    if (number.isNaN()) throw new GraphQLParseError('BigNumber', value);

    return number;
  },
  serialize: (value: BN | string | number) => {
    return value.toString();
  },
});

export const UuidType = new GraphQLScalarType({
  name: 'UuidType',
  description: 'Identificator',
  parseValue: (value: string) => {
    if (!isUuid(value)) throw new GraphQLParseError('UUID', value);

    return value;
  },
  serialize: (value: string) => {
    return value;
  },
});

export const CentralizedExchangeEnum = new GraphQLEnumType({
  name: 'CentralizedExchangeEnum',
  values: Object.keys(WalletExchangeType).reduce(
    (prev, name) => ({ ...prev, [name]: { value: name } }),
    {},
  ),
});

export const BlockchainEnum = new GraphQLEnumType({
  name: 'BlockchainEnum',
  values: Object.keys(container.blockchain).reduce(
    (prev, name) => ({ ...prev, [name]: { value: name } }),
    {},
  ),
});

export const BlockchainFilterInputType = new GraphQLInputObjectType({
  name: 'BlockchainFilterInputType',
  fields: {
    protocol: {
      type: GraphQLNonNull(BlockchainEnum),
    },
    network: {
      type: GraphQLString,
    },
  },
});

export const MetricColumnType = new GraphQLScalarType({
  name: 'MetricColumnType',
  description: 'Metric column',
  parseValue: (value: string) => {
    if (!/^[a-z0-9_]+$/i.test(value)) throw new GraphQLParseError('MetricColumn', value);

    return value;
  },
  serialize: (value: string) => {
    return value;
  },
});

export const MetricGroupEnum = new GraphQLEnumType({
  name: 'MetricGroupEnum',
  values: {
    hour: {},
    day: {},
    week: {},
    month: {},
    year: {},
  },
});

export const MetricChartType = new GraphQLObjectType({
  name: 'MetricChartType',
  fields: {
    date: {
      type: GraphQLNonNull(DateTimeType),
    },
    entityIdentifier: {
      type: GraphQLNonNull(UuidType),
    },
    provider: {
      type: GraphQLNonNull(GraphQLString),
    },
    min: {
      type: GraphQLNonNull(GraphQLString),
    },
    max: {
      type: GraphQLNonNull(GraphQLString),
    },
    avg: {
      type: GraphQLNonNull(GraphQLString),
    },
    sum: {
      type: GraphQLNonNull(GraphQLString),
    },
    count: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const MetricChangeType = new GraphQLObjectType({
  name: 'MetricChangeType',
  fields: {
    day: {
      type: GraphQLNonNull(GraphQLString),
    },
    week: {
      type: GraphQLNonNull(GraphQLString),
    },
    month: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export function onlyAllowed<TSource, TArgs = { [argName: string]: any }>(
  flag: string,
  wrapped: GraphQLFieldResolver<TSource, Request, TArgs>,
) {
  const [resource, permission] = flag.split('.');
  return (source: TSource, args: TArgs, context: Request, info: GraphQLResolveInfo) => {
    if (!context.acl.isAllowed(resource, permission)) throw new ForbiddenError('FORBIDDEN');

    return wrapped(source, args, context, info);
  };
}

export const WalletBlockchainTypeEnum = new GraphQLEnumType({
  name: 'WalletBlockchainTypeEnum',
  values: Object.values(Wallet.WalletBlockchainType).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const EthereumAddressType = new GraphQLScalarType({
  name: 'EthereumAddressType',
  description: 'Address of ethereum blockchain',
  parseValue: (value: string) => {
    if (!ethersUtils.isAddress(value)) {
      throw new GraphQLParseError('EthereumAddressType', value);
    }

    return value;
  },
  serialize: (value: string) => {
    return value;
  },
});

export const EthereumTransactionHashType = new GraphQLScalarType({
  name: 'EthereumTransactionHashType',
  description: 'Address of ethereum transaction hash',
  parseValue: (value: string) => {
    if (!ethersUtils.isHexString(value, 32)) {
      throw new GraphQLParseError('EthereumTransactionHashType', value);
    }

    return value;
  },
  serialize: (value: string) => {
    return value;
  },
});
