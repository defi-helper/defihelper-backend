import dayjs from 'dayjs';
import { validate as isUuid } from 'uuid';
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
import { QueryBuilder } from 'knex';
import { ForbiddenError } from 'apollo-server-express';

export class GraphQLParseError extends GraphQLError {
  constructor(type: string, value: any) {
    super(`Field parse error: value ${value} is a invalid ${type}`);
  }
}

export const PaginationType = new GraphQLObjectType({
  name: 'Pagination',
  fields: {
    count: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Count of list elements',
      resolve: ({ count: { count } }) => parseInt(count.toString(), 10),
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

export const metricsChartSelector = (
  avgGroupSelector: QueryBuilder,
  group: string,
  metric: string,
) => {
  const database = container.database();

  return container
    .database()
    .column('date')
    .max({ max: 'value' })
    .min({ min: 'value' })
    .count({ count: 'value' })
    .avg({ avg: 'value' })
    .sum({ sum: 'value' })
    .from(
      avgGroupSelector
        .column(database.raw(`DATE_TRUNC('${group}', "date") AS "date"`))
        .column(database.raw(`AVG((data->>'${metric}')::numeric) AS "value"`))
        .groupBy(database.raw(`DATE_TRUNC('${group}', "date")`))
        .as('avgGroupSelector'),
    )
    .groupBy('date');
};

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
