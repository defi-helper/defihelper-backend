import BN from 'bignumber.js';
import { GraphQLFieldConfig, GraphQLFloat, GraphQLNonNull, GraphQLObjectType } from 'graphql';
import { Request } from 'express';
import container from '@container';
import { BillStatus } from '@models/Billing/Entity';

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
    const allowedNetworks = ['1', '56', '1285', '43114'];
    const protocolFee = await allowedNetworks.reduce(async (sum, network) => {
      const row = await container.model
        .billingBillTable()
        .sum({ protocolFeeSum: 'protocolFee' })
        .where({ blockchain: 'ethereum', network, status: BillStatus.Accepted })
        .first();
      const protocolFeeSum = (row ?? { protocolFeeSum: null }).protocolFeeSum ?? '0';
      const nativeTokenPriceUSD = await container.blockchain.ethereum
        .byNetwork(network)
        .nativeTokenPrice();

      return new BN(protocolFeeSum).multipliedBy(nativeTokenPriceUSD).plus(await sum);
    }, Promise.resolve(new BN(0)));

    return {
      balanceUSD: protocolFee.toString(10),
    };
  },
};
