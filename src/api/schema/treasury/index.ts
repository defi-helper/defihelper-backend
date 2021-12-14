import BN from 'bignumber.js';
import { GraphQLFieldConfig, GraphQLFloat, GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { Request } from 'express';
import container from '@container';
import dfhContracts from '@defihelper/networks/contracts.json';

export const TreasuryType = new GraphQLObjectType({
  name: 'TreasuryType',
  fields: {
    balanceUSD: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const TreasuryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TreasuryType),
  resolve: async () => {
    const treasury = container.treasury();
    const allowedNetworks = ['1', '56', '1285', '43114'];
    const networks = Object.entries(dfhContracts)
      .filter(([networkId, contracts]) => contracts.Treasury && allowedNetworks.includes(networkId))
      .map(([networkId]) => networkId);
    const balancesUSD = await Promise.all(
      networks.map((networkId) => treasury.getEthBalanceUSD(networkId)),
    );

    return {
      balanceUSD: balancesUSD
        .reduce((sum, balanceUSD) => sum.plus(balanceUSD), new BN(0))
        .toString(10),
    };
  },
};
