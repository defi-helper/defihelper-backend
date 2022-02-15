import BN from 'bignumber.js';
import {
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql';
import { Request } from 'express';
import container from '@container';
import { BillStatus } from '@models/Billing/Entity';
import { Role } from '@models/User/Entity';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { metricWalletTokenTableName } from '@models/Metric/Entity';

export const TreasuryType = new GraphQLObjectType({
  name: 'TreasuryType',
  fields: {
    balanceUSD: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    portfoliosCount: {
      type: GraphQLNonNull(GraphQLInt),
    },
    protocolsCount: {
      type: GraphQLNonNull(GraphQLInt),
    },
    trackedUSD: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const TreasuryQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TreasuryType),
  resolve: async () => {
    const cache = container.cache();
    const cacheKey = 'defihelper:treasury:stats';
    const cachedStats = await new Promise((resolve) => {
      cache.get(cacheKey, (err, reply) => {
        if (err) return null;

        return resolve(JSON.parse(reply as string));
      });
    });
    if (cachedStats) return cachedStats;

    const database = container.database();

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

    const protocolsRow = await container.model
      .protocolTable()
      .count()
      .where('hidden', false)
      .first();

    const portfoliosRow = await container.model
      .userTable()
      .count()
      .whereIn('role', [Role.User, Role.Admin])
      .first();

    const trackedRow = await container
      .database()
      .sum('usd AS usd')
      .from(
        container.model
          .metricWalletTokenTable()
          .distinctOn(
            `${metricWalletTokenTableName}.wallet`,
            `${metricWalletTokenTableName}.contract`,
            `${metricWalletTokenTableName}.token`,
          )
          .column(`${metricWalletTokenTableName}.token`)
          .column(database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS usd`))
          .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
          .innerJoin(tokenAliasTableName, `${tokenTableName}.alias`, `${tokenAliasTableName}.id`)
          .where(function () {
            this.whereIn(`${tokenAliasTableName}.liquidity`, [
              TokenAliasLiquidity.Stable,
              TokenAliasLiquidity.Unstable,
            ]);
            this.andWhere(database.raw(`${metricWalletTokenTableName}.data->>'usd' IS NOT NULL`));
            this.andWhere(database.raw(`${metricWalletTokenTableName}.data->>'usd' != 'NaN'`));
          })
          .orderBy(`${metricWalletTokenTableName}.wallet`)
          .orderBy(`${metricWalletTokenTableName}.contract`)
          .orderBy(`${metricWalletTokenTableName}.token`)
          .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
          .as('metric'),
      )
      .first();
    const result = {
      balanceUSD: protocolFee.toString(10),
      protocolsCount: protocolsRow ? protocolsRow.count : '0',
      portfoliosCount: portfoliosRow ? portfoliosRow.count : '0',
      trackedUSD: trackedRow ? trackedRow.usd : '0',
    };

    cache.setex(cacheKey, 600, JSON.stringify(result));

    return result;
  },
};
