import {
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { Request } from 'express';
import container from '@container';
import BigNumber from 'bignumber.js';
import { tableName as userTableName } from '@models/User/Entity';
import {
  triggerCallHistoryTableName,
  triggerTableName,
  actionTableName,
} from '@models/Automate/Entity';
import { billTableName } from '@models/Billing/Entity';
import { AuthenticationError } from 'apollo-server-express';
import { DateTimeType, onlyAllowed } from '../types';

export const StatisticsPointType = new GraphQLObjectType({
  name: 'StatisticsPointType',
  fields: {
    date: {
      type: GraphQLNonNull(DateTimeType),
    },
    number: {
      type: GraphQLNonNull(GraphQLInt),
    },
  },
});

export const StatisticsEarningsPointType = new GraphQLObjectType({
  name: 'StatisticsEarningsPointType',
  fields: {
    date: {
      type: GraphQLNonNull(DateTimeType),
    },
    number: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const UsersRegisteringHistoryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(StatisticsPointType))),
  resolve: onlyAllowed('monitoring.view', async (root, _, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const database = container.database();
    const rows: { date: Date; number: number }[] = await container.model
      .userTable()
      .column(database.raw('count(distinct id) as number'))
      .column(database.raw(`date_trunc('day', "${userTableName}"."createdAt") "date"`))
      .orderBy('date')
      .groupBy('date');

    return rows.reduce<{ date: Date; number: number }[]>(
      (prev, cur) => [
        ...prev,
        {
          ...cur,
          number: new BigNumber(cur.number).plus(prev.pop()?.number ?? 0).toNumber(),
        },
      ],
      [],
    );
  }),
};

export const AutomatesCreationHistoryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(StatisticsPointType))),
  resolve: onlyAllowed('monitoring.view', async (root, _, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const database = container.database();
    const rows: { date: Date; number: number }[] = await container.model
      .automateTriggerTable()
      .column(database.raw('count(distinct id) as number'))
      .column(database.raw(`date_trunc('day', "${triggerTableName}"."createdAt") "date"`))
      .orderBy('date')
      .groupBy('date');

    return rows.reduce<{ date: Date; number: number }[]>(
      (prev, cur) => [
        ...prev,
        {
          ...cur,
          number: new BigNumber(cur.number).plus(prev.pop()?.number ?? 0).toNumber(),
        },
      ],
      [],
    );
  }),
};

export const AutoRestakeAutomatesCreationHistoryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(StatisticsPointType))),
  resolve: onlyAllowed('monitoring.view', async (root, _, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const database = container.database();
    const rows: { date: Date; number: number }[] = await container.model
      .automateActionTable()
      .column(database.raw('count(distinct id) as number'))
      .column(database.raw(`date_trunc('day', "${actionTableName}"."createdAt") "date"`))
      .where('type', 'ethereumAutomateRun')
      .orderBy('date')
      .groupBy('date');

    return rows.reduce<{ date: Date; number: number }[]>(
      (prev, cur) => [
        ...prev,
        {
          ...cur,
          number: new BigNumber(cur.number).plus(prev.pop()?.number ?? 0).toNumber(),
        },
      ],
      [],
    );
  }),
};

export const ProtocolEarningsHistoryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(StatisticsEarningsPointType))),
  args: {
    network: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
  resolve: onlyAllowed('monitoring.view', async (root, { network }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const database = container.database();
    const rows: { date: Date; number: number }[] = await container.model
      .billingBillTable()
      .column(database.raw('coalesce(sum("protocolFee"), 0) as number'))
      .column(database.raw(`date_trunc('day', "${billTableName}"."createdAt") "date"`))
      .where('network', network)
      .orderBy('date')
      .groupBy('date');

    return rows.reduce<{ date: Date; number: number }[]>(
      (prev, cur) => [
        ...prev,
        {
          ...cur,
          number: new BigNumber(cur.number).plus(prev.pop()?.number ?? 0).toNumber(),
        },
      ],
      [],
    );
  }),
};

export const AutomateRunHistoryFilterEnum = new GraphQLEnumType({
  name: 'AutomateRunHistoryFilterEnum',
  values: {
    onlySuccessful: {
      description: 'Only successful',
    },
    onlyFailed: {
      description: 'Only failed',
    },
    all: {
      description: 'All',
    },
  },
});
export const AutomateRunHistoryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLList(GraphQLNonNull(StatisticsPointType))),
  args: {
    filter: {
      type: GraphQLNonNull(AutomateRunHistoryFilterEnum),
    },
  },
  resolve: onlyAllowed('monitoring.view', async (root, { filter }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    let numberColumn;
    const database = container.database();
    switch (filter) {
      case 'all':
        numberColumn = database.raw('count(distinct id) as number');
        break;

      case 'onlySuccessful':
        numberColumn = database.raw('count(distinct id) filter (where error is null) as number');
        break;

      case 'onlyFailed':
        numberColumn = database.raw(
          'count(distinct id) filter (where error is not null) as number',
        );
        break;

      default:
        throw new Error('Unexpected case');
    }

    const rows: { date: Date; number: number }[] = await container.model
      .automateTriggerCallHistoryTable()
      .column(numberColumn)
      .column(
        database.raw(`date_trunc('day', "${triggerCallHistoryTableName}"."createdAt") "date"`),
      )
      .orderBy('date')
      .groupBy('date');

    return rows.reduce<{ date: Date; number: number }[]>(
      (prev, cur) => [
        ...prev,
        {
          ...cur,
          number: new BigNumber(cur.number).plus(prev.pop()?.number ?? 0).toNumber(),
        },
      ],
      [],
    );
  }),
};
