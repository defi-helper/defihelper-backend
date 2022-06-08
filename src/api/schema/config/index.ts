import container from '@container';
import { Request } from 'express';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { BlockchainEnum } from '../types';

export const EthereumNetworkIconEnum = new GraphQLEnumType({
  name: 'ConfigEthereumNetworkIconEnum',
  values: Object.values(container.blockchain.ethereum.networks).reduce<Record<string, {}>>(
    (result, { icon }) => {
      if (result[icon] !== undefined) return result;

      return {
        ...result,
        [icon]: { value: icon },
      };
    },
    {},
  ),
});

export const EthereumNetworkType = new GraphQLObjectType({
  name: 'ConfigEthereumNetworkType',
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLString),
    },
    title: {
      type: GraphQLNonNull(GraphQLString),
    },
    testnet: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    explorerURL: {
      type: GraphQLNonNull(GraphQLString),
    },
    coin: {
      type: GraphQLNonNull(GraphQLString),
    },
    decimals: {
      type: GraphQLNonNull(GraphQLInt),
    },
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
      resolve: () => 'ethereum',
    },
    icon: {
      type: GraphQLNonNull(EthereumNetworkIconEnum),
    },
  },
});

export const WavesNetworkIconEnum = new GraphQLEnumType({
  name: 'ConfigWavesNetworkIconEnum',
  values: Object.values(container.blockchain.waves.networks).reduce<Record<string, {}>>(
    (result, { icon }) => {
      if (result[icon] !== undefined) return result;

      return {
        ...result,
        [icon]: { value: icon },
      };
    },
    {},
  ),
});

export const WavesNetworkType = new GraphQLObjectType({
  name: 'ConfigWavesNetworkType',
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLString),
    },
    title: {
      type: GraphQLNonNull(GraphQLString),
    },
    testnet: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    explorerURL: {
      type: GraphQLNonNull(GraphQLString),
    },
    coin: {
      type: GraphQLNonNull(GraphQLString),
    },
    decimals: {
      type: GraphQLNonNull(GraphQLInt),
    },
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
      resolve: () => 'waves',
    },
    icon: {
      type: GraphQLNonNull(WavesNetworkIconEnum),
    },
  },
});

export const ConfigBlockchainFilterInputType = new GraphQLInputObjectType({
  name: 'ConfigBlockchainFilterInputType',
  fields: {
    testnet: {
      type: GraphQLBoolean,
    },
  },
});

export const ConfigType = new GraphQLObjectType({
  name: 'ConfigType',
  fields: {
    blockchain: {
      type: GraphQLNonNull(
        new GraphQLObjectType({
          name: 'ConfigBlockchainType',
          fields: {
            ethereum: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(EthereumNetworkType))),
              args: {
                filter: {
                  type: ConfigBlockchainFilterInputType,
                  defaultValue: {},
                },
              },
              resolve: (_, { filter }) => {
                return Object.values(container.blockchain.ethereum.networks).reduce<any[]>(
                  (result, { id, name, testnet, nativeTokenDetails, explorerURL, icon }) => {
                    if (typeof filter.testnet === 'boolean') {
                      if (filter.testnet !== testnet) return result;
                    }

                    return [
                      ...result,
                      {
                        id,
                        title: name,
                        testnet,
                        explorerURL: explorerURL.toString().slice(0, -1),
                        coin: nativeTokenDetails.symbol,
                        decimals: nativeTokenDetails.decimals,
                        icon,
                      },
                    ];
                  },
                  [],
                );
              },
            },
            waves: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(WavesNetworkType))),
              args: {
                filter: {
                  type: ConfigBlockchainFilterInputType,
                  defaultValue: {},
                },
              },
              resolve: (_, { filter }) => {
                return Object.values(container.blockchain.waves.networks).reduce<any[]>(
                  (result, { id, name, testnet, nativeTokenDetails, explorerURL, icon }) => {
                    if (typeof filter.testnet === 'boolean') {
                      if (filter.testnet !== testnet) return result;
                    }

                    return [
                      ...result,
                      {
                        id,
                        title: name,
                        testnet,
                        explorerURL: explorerURL.toString().slice(0, -1),
                        coin: nativeTokenDetails.symbol,
                        decimals: nativeTokenDetails.decimals,
                        icon,
                      },
                    ];
                  },
                  [],
                );
              },
            },
          },
        }),
      ),
    },
  },
});

export const ConfigQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ConfigType),
  resolve: () => {
    return {
      blockchain: {},
    };
  },
};
