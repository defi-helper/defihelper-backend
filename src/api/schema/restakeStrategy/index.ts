import { Request } from 'express';
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import BN from 'bignumber.js';
import dayjs from 'dayjs';
import { Point, hold, everyDayRestake, optimalRestake } from '@services/RestakeStrategy';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { BigNumberType, BlockchainEnum, DateTimeType, UuidType } from '../types';

export const PointType = new GraphQLObjectType<Point>({
  name: 'RestakeStrategyPointType',
  fields: {
    v: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    t: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const RestakeStrategyType = new GraphQLObjectType({
  name: 'RestakeStrategyType',
  fields: {
    hold: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
    everyDay: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
    optimal: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(PointType))),
    },
  },
});

export const RestakeStrategyQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(RestakeStrategyType),
  args: {
    blockchain: {
      type: BlockchainEnum,
      defaultValue: 'ethereum',
    },
    network: {
      type: GraphQLString,
      defaultValue: '1',
    },
    balance: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    apy: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
  resolve: async (root, { blockchain, network, balance, apy }) => {
    const holdPoints = hold(balance, apy);
    const everyDayPoints = await everyDayRestake(blockchain, network, balance, apy);
    const optimalPoints = await optimalRestake(blockchain, network, balance, apy);
    const targetDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

    return {
      hold: targetDays.map((t) => holdPoints[t] ?? { t, v: '0' }),
      everyDay: targetDays.map((t) => everyDayPoints[t] ?? { t, v: '0' }),
      optimal: targetDays.map((t) => optimalPoints.find((d) => d.t === t) ?? { t, v: '0' }),
    };
  },
};

export const RestakeCalculatorType = new GraphQLObjectType({
  name: 'RestakeCalculatorType',
  fields: {
    earnedUSD: {
      type: GraphQLNonNull(BigNumberType),
    },
    nextRestakeAt: {
      type: DateTimeType,
    },
  },
});

export const RestakeCalculatorQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(RestakeCalculatorType),
  args: {
    contract: {
      type: GraphQLNonNull(UuidType),
    },
    amount: {
      type: GraphQLNonNull(BigNumberType),
    },
    period: {
      type: GraphQLNonNull(GraphQLInt),
    },
    isRestake: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  },
  resolve: async (root, args) => {
    const nullValue = {
      earnedUSD: '0',
      nextRestakeAt: null,
    };
    const amount = new BN(args.amount);
    const { period, isRestake } = args;
    if (amount.lte('0') || period > 365) {
      return nullValue;
    }

    const contract = await container.model
      .contractTable()
      .innerJoin(
        contractBlockchainTableName,
        `${contractTableName}.id`,
        `${contractBlockchainTableName}.id`,
      )
      .where(`${contractTableName}.id`, args.contract)
      .first();
    if (!contract) return nullValue;

    const metric = await container.model
      .metricContractRegistryTable()
      .where('contract', contract.id)
      .first();
    if (!metric) return nullValue;

    if (!metric.data.aprYear) return nullValue;
    const aprYear = new BN(metric.data.aprYear);
    if (aprYear.lte(0)) return nullValue;

    if (!isRestake) {
      const holdPoints = hold(amount.toNumber(), aprYear.toNumber(), period);

      return {
        earnedUSD: holdPoints[holdPoints.length - 1].v,
      };
    }

    const optimalPoints = await optimalRestake(
      contract.blockchain,
      contract.network,
      amount.toNumber(),
      Number(aprYear),
      period,
    );

    return {
      earnedUSD: optimalPoints[optimalPoints.length - 1].v,
      nextRestakeAt: dayjs().add(optimalPoints[0].t, 'days').toDate(),
    };
  },
};
