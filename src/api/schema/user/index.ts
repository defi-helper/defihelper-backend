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
import container from '@container';
import { utils } from 'ethers';
import { Request } from 'express';
import { Locale } from '@services/I18n/container';
import { User, Role } from '@models/User/Entity';
import * as Wallet from '@models/Wallet/Entity';
import { Blockchain } from '@models/types';
import BN from 'bignumber.js';
import * as WavesCrypto from '@waves/ts-lib-crypto';
import * as WavesMarshall from '@waves/marshall';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { TokenAliasLiquidityEnum, TokenAliasType } from '@api/schema/token';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
import { tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { ContractType } from '../protocol';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  MetricChartType,
  MetricColumnType,
  MetricGroupEnum,
  metricsChartSelector,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
  WalletTypeEnum,
} from '../types';
import * as locales from '../../../locales';
import { UserBillingType, WalletBillingType } from '../billing';
import { UserStoreType } from '../store';

const TokenAliasFilterInputType = new GraphQLInputObjectType({
  name: 'UserMetricsTokenAliasFilterInputType',
  fields: {
    id: {
      type: GraphQLList(GraphQLNonNull(UuidType)),
    },
    liquidity: {
      type: GraphQLList(GraphQLNonNull(TokenAliasLiquidityEnum)),
      description: 'Liquidity token',
    },
  },
});

export const WalletMetricType = new GraphQLObjectType({
  name: 'WalletMetricType',
  fields: {
    stakedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    earnedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    balance: {
      type: GraphQLNonNull(GraphQLString),
    },
    usd: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const WalletType = new GraphQLObjectType<Wallet.Wallet, Request>({
  name: 'WalletType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
      description: 'Blockchain type',
    },
    network: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Blockchain network id',
    },
    type: {
      type: GraphQLNonNull(WalletTypeEnum),
      description: 'Type',
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address',
    },
    publicKey: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Public key',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
      resolve: (wallet) => {
        if (wallet.name !== '') return wallet.name;

        return `${wallet.address.slice(0, 5)}...${wallet.address.slice(-5)}`;
      },
    },
    contracts: {
      type: GraphQLNonNull(PaginateList('WalletContractListType', GraphQLNonNull(ContractType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletContractListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainFilterInputType,
              },
              protocol: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
              },
              hidden: {
                type: GraphQLBoolean,
              },
              search: {
                type: GraphQLString,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletContractListSortInputType',
          ['id', 'name', 'address', 'createdAt'],
          [{ column: 'name', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletContractListPaginationInputType'),
      },
      resolve: async (wallet, { filter, sort, pagination }) => {
        const select = container.model.contractTable().where(function () {
          this.whereIn(
            'id',
            container.model
              .walletContractLinkTable()
              .columns('contract')
              .where('wallet', wallet.id),
          );
          if (filter.blockchain !== undefined) {
            const { protocol, network } = filter.blockchain;
            this.andWhere('blockchain', protocol);
            if (network !== undefined) {
              this.andWhere('network', network);
            }
          }
          if (filter.protocol !== undefined) {
            this.whereIn('protocol', filter.protocol);
          }
          if (filter.hidden !== undefined) {
            this.andWhere('hidden', filter.hidden);
          }
          if (filter.search !== undefined && filter.search !== '') {
            this.andWhere(function () {
              this.where('name', 'iLike', `%${filter.search}%`);
              this.orWhere('address', 'iLike', `%${filter.search}%`);
            });
          }
        });

        return {
          list: await select
            .clone()
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count().first(),
          },
        };
      },
    },
    triggersCount: {
      type: GraphQLNonNull(GraphQLInt),
      resolve: async (wallet) => {
        const row = await container.model
          .automateTriggerTable()
          .count()
          .where('wallet', wallet.id)
          .first();
        if (!row) return 0;

        return row.count;
      },
    },
    metricChart: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(MetricChartType))),
      args: {
        metric: {
          type: GraphQLNonNull(MetricColumnType),
          description: 'Metric column',
        },
        group: {
          type: GraphQLNonNull(MetricGroupEnum),
          description: 'Truncate date mode',
        },
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletMetricChartFilterInputType',
            fields: {
              contract: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target contracts',
              },
              dateAfter: {
                type: DateTimeType,
                description: 'Created at equals or greater',
              },
              dateBefore: {
                type: DateTimeType,
                description: 'Created at less',
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletMetricChartPaginationInputType'),
      },
      resolve: async (wallet, { metric, group, filter, sort, pagination }) => {
        return metricsChartSelector(
          container.model
            .metricWalletTable()
            .where(function () {
              this.where('wallet', wallet.id);
              if (filter.contract) {
                this.whereIn('contract', filter.contract);
              }
              if (filter.dateAfter) {
                this.andWhere('date', '>=', filter.dateAfter.toDate());
              }
              if (filter.dateBefore) {
                this.andWhere('date', '<', filter.dateBefore.toDate());
              }
            })
            .groupBy('contract'),
          group,
          metric,
        )
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    tokenMetricChart: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(MetricChartType))),
      args: {
        metric: {
          type: GraphQLNonNull(MetricColumnType),
          description: 'Metric column',
        },
        group: {
          type: GraphQLNonNull(MetricGroupEnum),
          description: 'Truncate date mode',
        },
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletTokenMetricChartFilterInputType',
            fields: {
              tokenAlias: {
                type: TokenAliasFilterInputType,
                description: 'Target token alias',
              },
              tokenAddress: {
                type: GraphQLList(GraphQLNonNull(GraphQLString)),
                description: 'Target token address',
              },
              contract: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target contracts',
              },
              dateAfter: {
                type: DateTimeType,
                description: 'Created at equals or greater',
              },
              dateBefore: {
                type: DateTimeType,
                description: 'Created at less',
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletTokenMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletTokenMetricChartPaginationInputType'),
      },
      resolve: async (wallet, { metric, group, filter, sort, pagination }) => {
        return metricsChartSelector(
          container.model
            .metricWalletTokenTable()
            .where(function () {
              this.where('wallet', wallet.id);
              if (filter.contract) {
                this.whereIn('contract', filter.contract);
              }
              if (filter.tokenAddress) {
                this.whereIn('token', filter.tokenAddress);
              }
              if (filter.tokenAlias) {
                const { id, liquidity } = filter.tokenAlias;
                this.whereIn(
                  'token',
                  container.model
                    .tokenTable()
                    .column('address')
                    .whereIn(
                      'alias',
                      container.model
                        .tokenAliasTable()
                        .column('id')
                        .where(function () {
                          if (id) {
                            this.whereIn('id', id);
                          }
                          if (Array.isArray(liquidity) && liquidity.length > 0) {
                            this.whereIn('liquidity', liquidity);
                          }
                        }),
                    ),
                );
              }
              if (filter.dateAfter) {
                this.andWhere('date', '>=', filter.dateAfter.toDate());
              }
              if (filter.dateBefore) {
                this.andWhere('date', '<', filter.dateBefore.toDate());
              }
            })
            .groupBy('contract', 'token'),
          group,
          metric,
        )
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    metric: {
      type: GraphQLNonNull(WalletMetricType),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletMetricFilterInputType',
            fields: {
              tokenAlias: {
                type: TokenAliasFilterInputType,
                description: 'Target token alias',
              },
            },
          }),
          defaultValue: {},
        },
      },
      resolve: async (wallet, { filter }, { dataLoader }) => {
        const walletMetric = await dataLoader.walletMetric().load(wallet.id);
        const tokenMetric = await dataLoader
          .walletTokenMetric({
            tokenAlias: filter.tokenAlias,
          })
          .load(wallet.id);

        return {
          stakedUSD: walletMetric?.data.stakingUSD ?? '0',
          earnedUSD: walletMetric?.data.earnedUSD ?? '0',
          balance: tokenMetric.balance,
          usd: tokenMetric.usd,
        };
      },
    },
    billing: {
      type: GraphQLNonNull(WalletBillingType),
      resolve: (wallet) => wallet,
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

export const UserBlockchainType = new GraphQLObjectType<{
  blockchain: Blockchain;
  network: string;
  user: User;
}>({
  name: 'UserBlockchainType',
  fields: {
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
      description: 'Blockchain type',
    },
    network: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Blockchain network id',
    },
    wallets: {
      type: GraphQLNonNull(
        PaginateList('UserBlockchainWalletListType', GraphQLNonNull(WalletType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserBlockchainWalletListFilterInputType',
            fields: {
              search: {
                type: GraphQLString,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserBlockchainWalletListSortInputType',
          ['id', 'address', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserBlockchainWalletListPaginationInputType'),
      },
      resolve: async ({ user, blockchain, network }, { filter, sort, pagination }) => {
        let select = container.model
          .walletTable()
          .where('user', user.id)
          .andWhere('blockchain', blockchain)
          .andWhere('network', network);
        if (filter.search !== undefined && filter.search !== '') {
          select = select.andWhere('address', 'iLike', `%${filter.search}%`);
        }

        return {
          list: await select
            .clone()
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count().first(),
          },
        };
      },
    },
    tokenMetricChart: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(MetricChartType))),
      args: {
        metric: {
          type: GraphQLNonNull(MetricColumnType),
          description: 'Metric column',
        },
        group: {
          type: GraphQLNonNull(MetricGroupEnum),
          description: 'Truncate date mode',
        },
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserBlockchainWalletTokenMetricChartFilterInputType',
            fields: {
              dateAfter: {
                type: DateTimeType,
                description: 'Created at equals or greater',
              },
              dateBefore: {
                type: DateTimeType,
                description: 'Created at less',
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserBlockchainWalletTokenMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserBlockchainWalletTokenMetricChartPaginationInputType'),
      },
      resolve: async (
        { user, blockchain, network },
        { metric, group, filter, sort, pagination },
      ) => {
        const walletSelect = container.model
          .walletTable()
          .columns('id')
          .where('user', user.id)
          .andWhere('blockchain', blockchain)
          .andWhere('network', network);

        return metricsChartSelector(
          container.model
            .metricWalletTokenTable()
            .where(function () {
              this.whereIn('wallet', walletSelect);
              if (filter.dateAfter) {
                this.andWhere('date', '>=', filter.dateAfter.toDate());
              }
              if (filter.dateBefore) {
                this.andWhere('date', '<', filter.dateBefore.toDate());
              }
            })
            .groupBy('contract', 'wallet', 'token'),
          group,
          metric,
        )
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
  },
});

export const RoleType = new GraphQLEnumType({
  name: 'UserRoleEnum',
  values: {
    [Role.Candidate]: {
      description: 'Candidate',
    },
    [Role.User]: {
      description: 'User',
    },
    [Role.Admin]: {
      description: 'Administrator',
    },
  },
});

export const LocaleEnum = new GraphQLEnumType({
  name: 'LocaleEnum',
  values: Object.keys(locales).reduce(
    (res, locale) => ({ ...res, [locale]: { value: locale } }),
    {},
  ),
});

export const UserMetricType = new GraphQLObjectType({
  name: 'UserMetricType',
  fields: {
    stakedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    earnedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    worth: {
      type: GraphQLNonNull(GraphQLString),
    },
    apy: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const UserType = new GraphQLObjectType<User, Request>({
  name: 'UserType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    role: {
      type: GraphQLNonNull(RoleType),
      description: 'Access role',
    },
    locale: {
      type: GraphQLNonNull(LocaleEnum),
      description: 'Current user locale',
    },
    tokenAliases: {
      type: GraphQLNonNull(PaginateList('UserTokenAliasListType', GraphQLNonNull(TokenAliasType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserTokenAliasListFilterInputType',
            fields: {
              liquidity: {
                type: GraphQLList(GraphQLNonNull(TokenAliasLiquidityEnum)),
                description: 'Liquidity token',
              },
            },
          }),
          defaultValue: {},
        },
        pagination: PaginationArgument('UserTokenAliasListPaginationInputType'),
      },
      resolve: async (user, { filter, pagination }) => {
        const select = container.model
          .metricWalletTokenTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(tokenTableName, `${tokenTableName}.id`, `${metricWalletTokenTableName}.token`)
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenTableName}.wallet`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            if (Array.isArray(filter.liquidity) && filter.liquidity.length > 0) {
              this.whereIn(`${tokenAliasTableName}.liquidity`, filter.liquidity);
            }
          })
          .groupBy(`${tokenAliasTableName}.id`);

        return {
          list: await select
            .clone()
            .orderBy('createdAt', 'desc')
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().countDistinct(`${tokenAliasTableName}.id`).first(),
          },
        };
      },
    },
    wallets: {
      type: GraphQLNonNull(PaginateList('WalletListType', GraphQLNonNull(WalletType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainFilterInputType,
              },
              type: {
                type: WalletTypeEnum,
              },
              search: {
                type: GraphQLString,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletListSortInputType',
          ['id', 'address', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model.walletTable().where(function () {
          this.where('user', user.id);
          const { blockchain, type, search } = filter;
          if (blockchain) {
            const { protocol, network } = blockchain;
            this.andWhere('blockchain', protocol);
            if (network !== undefined) {
              this.andWhere('network', network);
            }
          }
          if (type) {
            this.andWhere('type', type);
          }
          if (search !== undefined && search !== '') {
            this.andWhere('address', 'iLike', `%${search}%`);
          }
        });

        return {
          list: await select
            .clone()
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count().first(),
          },
        };
      },
    },
    blockchains: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserBlockchainType))),
      resolve: async (user, args, { dataLoader }) => {
        const blockchains = await dataLoader.userBlockchains().load(user.id);

        return blockchains.map(({ blockchain, network }) => ({
          blockchain,
          network,
          name:
            container.blockchain[blockchain]?.byNetwork(network)?.name ??
            `${blockchain}:${network}`,
          user,
        }));
      },
    },
    metricChart: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(MetricChartType))),
      args: {
        metric: {
          type: GraphQLNonNull(MetricColumnType),
          description: 'Metric column',
        },
        group: {
          type: GraphQLNonNull(MetricGroupEnum),
          description: 'Truncate date mode',
        },
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserMetricChartFilterInputType',
            fields: {
              contract: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target contracts',
              },
              wallet: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target wallets',
              },
              blockchain: {
                type: BlockchainFilterInputType,
              },
              dateAfter: {
                type: DateTimeType,
                description: 'Created at equals or greater',
              },
              dateBefore: {
                type: DateTimeType,
                description: 'Created at less',
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserMetricChartPaginationInputType'),
      },
      resolve: async (user, { metric, group, filter, sort, pagination }) => {
        const walletSelect = container.model
          .walletTable()
          .columns('id')
          .where(function () {
            this.where('user', user.id);
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere('blockchain', protocol);
              if (network !== undefined) {
                this.andWhere('network', network);
              }
            }
            if (filter.wallet) {
              this.whereIn('id', filter.wallet);
            }
          });

        return metricsChartSelector(
          container.model
            .metricWalletTable()
            .where(function () {
              this.whereIn('wallet', walletSelect);
              if (filter.contract) {
                this.whereIn('contract', filter.contract);
              }
              if (filter.dateAfter) {
                this.andWhere('date', '>=', filter.dateAfter.toDate());
              }
              if (filter.dateBefore) {
                this.andWhere('date', '<', filter.dateBefore.toDate());
              }
            })
            .groupBy('contract', 'wallet'),
          group,
          metric,
        )
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    tokenMetricChart: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(MetricChartType))),
      args: {
        metric: {
          type: GraphQLNonNull(MetricColumnType),
          description: 'Metric column',
        },
        group: {
          type: GraphQLNonNull(MetricGroupEnum),
          description: 'Truncate date mode',
        },
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserTokenMetricChartFilterInputType',
            fields: {
              tokenAlias: {
                type: TokenAliasFilterInputType,
                description: 'Target token alias',
              },
              tokenAddress: {
                type: GraphQLList(GraphQLNonNull(GraphQLString)),
                description: 'Target token address',
              },
              contract: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target contracts',
              },
              blockchain: {
                type: BlockchainFilterInputType,
              },
              wallet: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target wallets',
              },
              dateAfter: {
                type: DateTimeType,
                description: 'Created at equals or greater',
              },
              dateBefore: {
                type: DateTimeType,
                description: 'Created at less',
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserTokenMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserTokenMetricChartPaginationInputType'),
      },
      resolve: async (user, { metric, group, filter, sort, pagination }) => {
        const walletSelect = container.model
          .walletTable()
          .columns('id')
          .where(function () {
            this.where('user', user.id);
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere('blockchain', protocol);
              if (network !== undefined) {
                this.andWhere('network', network);
              }
            }
          });

        return metricsChartSelector(
          container.model
            .metricWalletTokenTable()
            .where(function () {
              this.whereIn('wallet', walletSelect);
              if (filter.contract) {
                this.whereIn('contract', filter.contract);
              }
              if (filter.tokenAddress) {
                this.whereIn('token', filter.tokenAddress);
              }
              if (filter.tokenAlias) {
                const { id, liquidity } = filter.tokenAlias;
                this.whereIn(
                  'token',
                  container.model
                    .tokenTable()
                    .column('id')
                    .whereIn(
                      'alias',
                      container.model
                        .tokenAliasTable()
                        .column('id')
                        .where(function () {
                          if (id) {
                            this.whereIn('id', id);
                          }
                          if (Array.isArray(liquidity) && liquidity.length > 0) {
                            this.whereIn('liquidity', liquidity);
                          }
                        }),
                    ),
                );
              }
              if (filter.wallet) {
                this.whereIn('wallet', filter.wallet);
              }
              if (filter.dateAfter) {
                this.andWhere('date', '>=', filter.dateAfter.toDate());
              }
              if (filter.dateBefore) {
                this.andWhere('date', '<', filter.dateBefore.toDate());
              }
            })
            .groupBy('contract', 'wallet', 'token'),
          group,
          metric,
        )
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    metric: {
      type: GraphQLNonNull(UserMetricType),
      resolve: async (user, args, { dataLoader }) => {
        const stakedUSD = await dataLoader.userMetric({ metric: 'stakingUSD' }).load(user.id);
        const earnedUSD = await dataLoader.userMetric({ metric: 'earnedUSD' }).load(user.id);

        return {
          stakedUSD,
          earnedUSD,
          worth: new BN(stakedUSD).plus(earnedUSD).toString(10),
          apy: await dataLoader.userAPRMetric({ metric: 'aprYear' }).load(user.id),
        };
      },
    },
    billing: {
      type: GraphQLNonNull(UserBillingType),
      resolve: (user) => user,
    },
    store: {
      type: GraphQLNonNull(UserStoreType),
      resolve: (user) => user,
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

export const UserListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('UserListQuery', GraphQLNonNull(UserType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'UserListFilterInputType',
        fields: {
          role: {
            type: RoleType,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'UserListSortInputType',
      ['id', 'createdAt'],
      [{ column: 'createdAt', order: 'asc' }],
    ),
    pagination: PaginationArgument('UserListPaginationInputType'),
  },
  resolve: onlyAllowed('user.list', async (root, { filter, sort, pagination }) => {
    const select = container.model.userTable().where(function () {
      const { role } = filter;
      if (role !== undefined) {
        this.andWhere('role', role);
      }
    });

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  }),
};

export const AuthType = new GraphQLObjectType({
  name: 'AuthType',
  fields: {
    user: {
      type: GraphQLNonNull(UserType),
      description: 'Authenticated user account',
    },
    sid: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Session ID',
    },
  },
});

export const AuthEthereumMutation: GraphQLFieldConfig<any, Request> = {
  type: AuthType,
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AuthEthereumInputType',
          fields: {
            network: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Blockchain network id',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Wallet address',
            },
            message: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Message',
            },
            signature: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Signed message',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    const { network, address, message, signature } = input;
    if (typeof message !== 'string' || message.length < 5) return null;

    const hash = utils.hashMessage(message);
    const hashBytes = utils.arrayify(hash);
    const recoveredPubKey = utils.recoverPublicKey(hashBytes, signature);
    const recoveredAddress = utils.recoverAddress(hashBytes, signature).toLowerCase();
    if (address.toLowerCase() !== recoveredAddress) return null;

    const duplicate = await container.model
      .walletTable()
      .where({
        blockchain: 'ethereum',
        network,
        address: recoveredAddress,
      })
      .first();

    if (duplicate) {
      const user = await container.model.userTable().where('id', duplicate.user).first();
      if (!user) return null;

      const sid = container.model.sessionService().generate(user);
      return { user, sid };
    }
    const user = currentUser ?? (await container.model.userService().create(Role.User));
    await container.model
      .walletService()
      .create(
        user,
        'ethereum',
        network,
        Wallet.WalletType.Wallet,
        recoveredAddress,
        recoveredPubKey,
        '',
      );
    const sid = container.model.sessionService().generate(user);

    return { user, sid };
  },
};

export const AuthWavesMutation: GraphQLFieldConfig<any, Request> = {
  type: AuthType,
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AuthWavesInputType',
          fields: {
            network: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Blockchain network id',
            },
            publicKey: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Wallet public key',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Wallet address',
            },
            message: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Message',
            },
            signature: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Signed message',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    const { network, address, message, publicKey, signature } = input;
    if (typeof message !== 'string' || message.length < 5) return null;

    const serializer = WavesMarshall.binary.serializerFromSchema(
      WavesMarshall.schemas.txFields.data[1],
    );
    const isValidSignature = WavesCrypto.verifySignature(
      publicKey,
      WavesCrypto.concat(
        [255, 255, 255, 2],
        serializer([{ type: 'string', key: 'name', value: message }]),
      ),
      signature,
    );
    const recoveredAddress = WavesCrypto.address({ publicKey }, network);
    if (!isValidSignature || recoveredAddress !== address) return null;

    const duplicate = await container.model
      .walletTable()
      .where({
        blockchain: 'waves',
        network,
        address: recoveredAddress,
      })
      .first();

    if (duplicate) {
      const user = await container.model.userTable().where('id', duplicate.user).first();
      if (!user) return null;

      const sid = container.model.sessionService().generate(user);
      return { user, sid };
    }
    const user = currentUser ?? (await container.model.userService().create(Role.User));
    await container.model
      .walletService()
      .create(user, 'waves', network, Wallet.WalletType.Wallet, recoveredAddress, publicKey, '');
    const sid = container.model.sessionService().generate(user);

    return { user, sid };
  },
};

export const AddWalletMutation: GraphQLFieldConfig<any, Request> = {
  type: AuthType,
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'AddWalletInputType',
          fields: {
            blockchain: {
              type: GraphQLNonNull(BlockchainEnum),
              description: 'Blockchain',
            },
            network: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Blockchain network id',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Wallet address',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('wallet.add', async (root, { input }, { currentUser }) => {
    const { blockchain, network, address } = input;
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    await container.model
      .walletService()
      .create(currentUser, blockchain, network, Wallet.WalletType.Wallet, address, '', '');
    const sid = container.model.sessionService().generate(currentUser);

    return { currentUser, sid };
  }),
};

export const WalletUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(WalletType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'WalletUpdateInputType',
          fields: {
            name: {
              type: GraphQLString,
              description: 'Name',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('wallet.update-own', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const wallet = await container.model.walletTable().where('id', id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const { name } = input;
    const updated = await container.model.walletService().update({
      ...wallet,
      name: typeof name === 'string' ? name : wallet.name,
    });

    return updated;
  }),
};

export const WalletDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('wallet.delete-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const wallet = await container.model.walletTable().where('id', id).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    await container.model.walletService().delete(wallet);

    return true;
  }),
};

export const UserUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'UserUpdateInputType',
          fields: {
            role: {
              type: RoleType,
            },
            locale: {
              type: LocaleEnum,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('user.update', async (root, { id, input }) => {
    const user = await container.model.userTable().where('id', id).first();
    if (!user) throw new UserInputError('User not found');

    const { role, locale } = input as { role?: Role; locale?: Locale };
    const updated = await container.model.userService().update({
      ...user,
      role: role !== undefined ? role : user.role,
      locale: locale !== undefined ? locale : user.locale,
    });

    return updated;
  }),
};
