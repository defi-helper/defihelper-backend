import { Request } from 'express';
import {
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { Point, hold, everyDayRestake, optimalRestake } from '@services/RestakeStrategy';
import { BlockchainEnum } from '../types';

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
