import {
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql';
import { Request } from 'express';
import container from '@container';

export const TreasuryType = new GraphQLObjectType({
  name: 'TreasuryType',
  fields: {
    portfoliosCount: {
      type: GraphQLNonNull(GraphQLInt),
    },
    protocolsCount: {
      type: GraphQLNonNull(GraphQLInt),
    },
    contractsCount: {
      type: GraphQLNonNull(GraphQLInt),
    },
    trackedUSD: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const TreasuryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TreasuryType),
  resolve: () => {
    return new Promise((resolve) => {
      container.cache().get('defihelper:treasury:stats', (err, reply) => {
        if (err) {
          return {
            protocolsCount: '0',
            contractsCount: '0',
            portfoliosCount: '0',
            trackedUSD: '0',
          };
        }

        return resolve(JSON.parse(reply as string));
      });
    });
  },
};
