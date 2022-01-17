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
import { withFilter } from 'graphql-subscriptions';
import container from '@container';
import asyncify from 'callback-to-async-iterator';
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
import { metricWalletTableName, metricWalletTokenTableName } from '@models/Metric/Entity';
import {
  TokenAlias,
  TokenAliasLiquidity,
  tokenAliasTableName,
  tokenTableName,
} from '@models/Token/Entity';
import { contractTableName as protocolContractTableName } from '@models/Protocol/Entity';
import { ContractType } from '../protocol';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  MetricChartType,
  MetricColumnType,
  MetricGroupEnum,
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

export const WalletTokenAliasMetricType = new GraphQLObjectType({
  name: 'WalletTokenAliasMetricType',
  fields: {
    balance: {
      type: GraphQLNonNull(GraphQLString),
    },
    usd: {
      type: GraphQLNonNull(GraphQLString),
    },
    portfolioPercent: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const WalletTokenAliasType = new GraphQLObjectType<
  { wallet: Wallet.Wallet; tokenAlias: TokenAlias },
  Request
>({
  name: 'WalletTokenAliasType',
  fields: {
    tokenAlias: {
      type: GraphQLNonNull(TokenAliasType),
    },
    metric: {
      type: GraphQLNonNull(WalletTokenAliasMetricType),
      resolve: async ({ wallet, tokenAlias }) => {
        const database = container.database();
        const metric = await container
          .database()
          .sum({ balance: 'balance', usd: 'usd' })
          .from(
            container.model
              .metricWalletTokenTable()
              .distinctOn(
                `${metricWalletTokenTableName}.contract`,
                `${metricWalletTokenTableName}.token`,
              )
              .columns([
                database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS usd`),
                database.raw(
                  `(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`,
                ),
              ])
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenTableName}.token`,
              )
              .whereRaw(
                `(${metricWalletTokenTableName}.data->>'usd' IS NOT NULL OR ${metricWalletTokenTableName}.data->>'balance' IS NOT NULL)`,
              )
              .andWhere(`${tokenTableName}.alias`, tokenAlias.id)
              .andWhere(`${metricWalletTokenTableName}.wallet`, wallet.id)
              .orderBy(`${metricWalletTokenTableName}.contract`)
              .orderBy(`${metricWalletTokenTableName}.token`)
              .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
              .as('metric'),
          )
          .first();

        return {
          balance: metric?.balance ?? '0',
          usd: metric?.usd ?? '0',
          portfolioPercent: '0',
        };
      },
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
    worth: {
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
    tokenAliases: {
      type: GraphQLNonNull(
        PaginateList('WalletTokenAliasListType', GraphQLNonNull(WalletTokenAliasType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletTokenAliasListFilterInputType',
            fields: {
              liquidity: {
                type: GraphQLList(GraphQLNonNull(TokenAliasLiquidityEnum)),
                description: 'Liquidity token',
              },
            },
          }),
          defaultValue: {},
        },
        pagination: PaginationArgument('WalletTokenAliasListPaginationInputType'),
      },
      resolve: async (wallet, { filter, pagination }) => {
        const select = container.model
          .metricWalletTokenTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(tokenTableName, `${tokenTableName}.id`, `${metricWalletTokenTableName}.token`)
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .where(function () {
            this.where(`${metricWalletTokenTableName}.wallet`, wallet.id);
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
            .offset(pagination.offset)
            .then((rows) => rows.map((tokenAlias) => ({ tokenAlias, wallet }))),
          pagination: {
            count: await select.clone().countDistinct(`${tokenAliasTableName}.id`).first(),
          },
        };
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
        const database = container.database();
        const select = container.model
          .metricWalletTable()
          .distinctOn(
            `${metricWalletTableName}.wallet`,
            `${metricWalletTableName}.contract`,
            'date',
          )
          .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricWalletTableName}.date) AS "date"`))
          .where(function () {
            this.where(`${metricWalletTableName}.wallet`, wallet.id).andWhere(
              database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.contract) && filter.contract.length > 0) {
              this.whereIn(`${metricWalletTableName}.contract`, filter.contract);
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTableName}.wallet`)
          .orderBy(`${metricWalletTableName}.contract`)
          .orderBy('date')
          .orderBy(`${metricWalletTableName}.date`, 'DESC');

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('date')
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
        const database = container.database();
        let select = container.model
          .metricWalletTokenTable()
          .distinctOn(
            `${metricWalletTokenTableName}.wallet`,
            `${metricWalletTokenTableName}.token`,
            'date',
          )
          .column(
            database.raw(`(${metricWalletTokenTableName}.data->>'${metric}')::numeric AS value`),
          )
          .column(
            database.raw(`DATE_TRUNC('${group}', ${metricWalletTokenTableName}.date) AS "date"`),
          )
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenTableName}.wallet`,
          )
          .where(function () {
            this.where(`${metricWalletTokenTableName}.wallet`, wallet.id).andWhere(
              database.raw(`${metricWalletTokenTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTokenTableName}.wallet`)
          .orderBy(`${metricWalletTokenTableName}.token`)
          .orderBy('date')
          .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');
        if (filter) {
          if (filter.tokenAlias) {
            select = select
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenTableName}.token`,
              )
              .innerJoin(
                tokenAliasTableName,
                `${tokenAliasTableName}.id`,
                `${tokenTableName}.alias`,
              )
              .where(function () {
                if (Array.isArray(filter.tokenAlias.id) && filter.tokenAlias.id.length > 0) {
                  this.whereIn(`${tokenAliasTableName}.id`, filter.tokenAlias.id);
                }
                if (
                  Array.isArray(filter.tokenAlias.liquidity) &&
                  filter.tokenAlias.liquidity.length > 0
                ) {
                  this.whereIn(`${tokenAliasTableName}.liquidity`, filter.tokenAlias.liquidity);
                }
              });
          }
        }

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('date')
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
              contract: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
                description: 'Target contracts',
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
            contract: filter.contract ?? [],
          })
          .load(wallet.id);

        const stakedUSD = walletMetric?.data.stakingUSD ?? '0';
        const earnedUSD = walletMetric?.data.earnedUSD ?? '0';
        return {
          stakedUSD,
          earnedUSD,
          balance: tokenMetric.balance,
          usd: tokenMetric.usd,
          worth: new BN(stakedUSD).plus(earnedUSD).plus(tokenMetric.usd).toString(10),
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
              tokenAlias: {
                type: TokenAliasFilterInputType,
                description: 'Target token alias',
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
        const database = container.database();
        let select = container.model
          .metricWalletTokenTable()
          .distinctOn(
            `${metricWalletTokenTableName}.wallet`,
            `${metricWalletTokenTableName}.token`,
            'date',
          )
          .column(
            database.raw(`(${metricWalletTokenTableName}.data->>'${metric}')::numeric AS value`),
          )
          .column(
            database.raw(`DATE_TRUNC('${group}', ${metricWalletTokenTableName}.date) AS "date"`),
          )
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenTableName}.wallet`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id)
              .andWhere(`${walletTableName}.blockchain`, blockchain)
              .andWhere(`${walletTableName}.network`, network)
              .andWhere(
                database.raw(`${metricWalletTokenTableName}.data->>'${metric}' IS NOT NULL`),
              );
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTokenTableName}.wallet`)
          .orderBy(`${metricWalletTokenTableName}.token`)
          .orderBy('date')
          .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');
        if (filter) {
          if (filter.tokenAlias) {
            select = select
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenTableName}.token`,
              )
              .innerJoin(
                tokenAliasTableName,
                `${tokenAliasTableName}.id`,
                `${tokenTableName}.alias`,
              )
              .where(function () {
                if (Array.isArray(filter.tokenAlias.id) && filter.tokenAlias.id.length > 0) {
                  this.whereIn(`${tokenAliasTableName}.id`, filter.tokenAlias.id);
                }
                if (
                  Array.isArray(filter.tokenAlias.liquidity) &&
                  filter.tokenAlias.liquidity.length > 0
                ) {
                  this.whereIn(`${tokenAliasTableName}.liquidity`, filter.tokenAlias.liquidity);
                }
              });
          }
        }

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('date')
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
    balanceUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
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
              protocol: {
                type: UuidType,
                description: 'Only tokens touched by protocol',
              },
            },
          }),
          defaultValue: {},
        },
        pagination: PaginationArgument('UserTokenAliasListPaginationInputType'),
      },
      resolve: async (user, { filter, pagination }) => {
        let select = container.model
          .metricWalletTokenTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(tokenTableName, `${tokenTableName}.id`, `${metricWalletTokenTableName}.token`)
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenTableName}.wallet`,
          )
          .where(`${walletTableName}.user`, user.id)
          .groupBy(`${tokenAliasTableName}.id`);

        if (Array.isArray(filter.liquidity) && filter.liquidity.length > 0) {
          select = select.whereIn(`${tokenAliasTableName}.liquidity`, filter.liquidity);
        }

        if (filter.protocol) {
          select = select
            .innerJoin(
              protocolContractTableName,
              `${protocolContractTableName}.id`,
              `${metricWalletTokenTableName}.contract`,
            )
            .andWhere(`${protocolContractTableName}.protocol`, filter.protocol);
        }

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
              id: {
                type: UuidType,
              },
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
          const { id, blockchain, type, search } = filter;
          if (id) {
            this.andWhere('id', id);
          }
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
        const database = container.database();
        const select = container.model
          .metricWalletTable()
          .distinctOn(
            `${metricWalletTableName}.wallet`,
            `${metricWalletTableName}.contract`,
            'date',
          )
          .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricWalletTableName}.date) AS "date"`))
          .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
          .where(function () {
            this.where(`${walletTableName}.user`, user.id).andWhere(
              database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere(`${walletTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${walletTableName}.network`, network);
              }
            }
            if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
              this.whereIn(`${metricWalletTableName}.wallet`, filter.wallet);
            }
            if (Array.isArray(filter.contract) && filter.contract.length > 0) {
              this.whereIn(`${metricWalletTableName}.contract`, filter.contract);
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTableName}.wallet`)
          .orderBy(`${metricWalletTableName}.contract`)
          .orderBy('date')
          .orderBy(`${metricWalletTableName}.date`, 'DESC');

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('date')
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
        const database = container.database();
        let select = container.model
          .metricWalletTokenTable()
          .distinctOn(
            `${metricWalletTokenTableName}.wallet`,
            `${metricWalletTokenTableName}.contract`,
            `${metricWalletTokenTableName}.token`,
            'date',
          )
          .column(
            database.raw(`(${metricWalletTokenTableName}.data->>'${metric}')::numeric AS value`),
          )
          .column(
            database.raw(`DATE_TRUNC('${group}', ${metricWalletTokenTableName}.date) AS "date"`),
          )
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenTableName}.wallet`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id).andWhere(
              database.raw(`${metricWalletTokenTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere(`${walletTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${walletTableName}.network`, network);
              }
            }
            if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
              this.whereIn(`${metricWalletTokenTableName}.wallet`, filter.wallet);
            }
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTokenTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTokenTableName}.wallet`)
          .orderBy(`${metricWalletTokenTableName}.contract`)
          .orderBy(`${metricWalletTokenTableName}.token`)
          .orderBy('date')
          .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');
        if (filter) {
          if (filter.tokenAlias) {
            select = select
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenTableName}.token`,
              )
              .innerJoin(
                tokenAliasTableName,
                `${tokenAliasTableName}.id`,
                `${tokenTableName}.alias`,
              )
              .where(function () {
                if (Array.isArray(filter.tokenAlias.id) && filter.tokenAlias.id.length > 0) {
                  this.whereIn(`${tokenAliasTableName}.id`, filter.tokenAlias.id);
                }
                if (
                  Array.isArray(filter.tokenAlias.liquidity) &&
                  filter.tokenAlias.liquidity.length > 0
                ) {
                  this.whereIn(`${tokenAliasTableName}.liquidity`, filter.tokenAlias.liquidity);
                }
              });
          }
        }

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('date')
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
        const balanceUSD = await dataLoader
          .userTokenMetric({
            contract: null,
            tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
          })
          .load(user.id);

        return {
          balanceUSD,
          stakedUSD,
          earnedUSD,
          worth: new BN(stakedUSD).plus(earnedUSD).plus(balanceUSD).toString(10),
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
            merge: {
              type: GraphQLBoolean,
              description: 'Merged target account to current account',
              defaultValue: false,
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    const { network, address, message, signature, merge } = input;
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

      if (merge) {
        if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
        await container.model.walletService().changeOwner(duplicate, currentUser);

        const sid = container.model.sessionService().generate(currentUser);
        return { user: currentUser, sid };
      }

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

export const WalletMetricScanMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    wallet: {
      type: GraphQLNonNull(UuidType),
      description: 'Wallet id',
    },
    contract: {
      type: GraphQLNonNull(UuidType),
      description: 'Contract id',
    },
  },
  resolve: async (root, { wallet: walletId, contract: contractId }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const wallet = await container.model.walletTable().where('id', walletId).first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');

    const contract = await container.model.contractTable().where('id', contractId).first();
    if (!contract) throw new UserInputError('Contract not found');

    const link = await container.model
      .walletContractLinkTable()
      .where({ wallet: wallet.id, contract: contract.id })
      .first();
    if (!link) throw new UserInputError('Wallet not linked to contract');
    await container.model.queueService().push('metricsWalletCurrent', {
      contract: contract.id,
      wallet: wallet.id,
    });

    return true;
  },
};

export const WalletMetricUpdatedEvent = new GraphQLObjectType({
  name: 'WalletMetricUpdatedEvent',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    wallet: {
      type: GraphQLNonNull(WalletType),
      resolve: ({ wallet }) => {
        return container.model.walletTable().where('id', wallet).first();
      },
    },
    contract: {
      type: GraphQLNonNull(ContractType),
      resolve: ({ contract }) => {
        return container.model.contractTable().where('id', contract).first();
      },
    },
  },
});

export const OnWalletCreated: GraphQLFieldConfig<{ id: string }, Request> = {
  type: GraphQLNonNull(WalletType),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnWalletCreatedFilterInputType',
        fields: {
          user: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
        },
      }),
      defaultValue: {},
    },
  },
  subscribe: withFilter(
    () =>
      asyncify((callback) =>
        Promise.resolve(
          container.cacheSubscriber('defihelper:channel:onWalletCreated').onJSON(callback),
        ),
      ),
    async ({ id }, { filter }) => {
      if (!filter.user) {
        return false;
      }

      const wallet = await container.model.walletTable().where({ id }).first();
      return !(!wallet || !filter.user.includes(wallet.user));
    },
  ),
  resolve: ({ id }) => {
    return container.model.walletTable().where('id', id).first();
  },
};

export const OnWalletMetricUpdated: GraphQLFieldConfig<
  { id: string; wallet: string; contract: string },
  Request
> = {
  type: GraphQLNonNull(WalletMetricUpdatedEvent),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnWalletMetricUpdatedFilterInputType',
        fields: {
          contract: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          wallet: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          user: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
        },
      }),
      defaultValue: {},
    },
  },
  subscribe: withFilter(
    () =>
      asyncify((callback) =>
        Promise.resolve(
          container.cacheSubscriber('defihelper:channel:onWalletMetricUpdated').onJSON(callback),
        ),
      ),
    async ({ wallet: walletId, contract }, { filter }) => {
      let result = true;
      if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
        result = result && filter.wallet.includes(walletId);
      }
      if (Array.isArray(filter.contract) && filter.contract.length > 0) {
        result = result && filter.contract.includes(contract);
      }
      if (Array.isArray(filter.user) && filter.user.length > 0) {
        const wallet = await container.model.walletTable().where('id', walletId).first();
        if (!wallet) return false;

        result = result && filter.user.includes(wallet.user);
      }

      return result;
    },
  ),
  resolve: (event) => event,
};

export const TokenMetricUpdatedEvent = new GraphQLObjectType({
  name: 'TokenMetricUpdatedEvent',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    wallet: {
      type: GraphQLNonNull(WalletType),
      resolve: ({ wallet }) => {
        return container.model.walletTable().where('id', wallet).first();
      },
    },
    contract: {
      type: ContractType,
      resolve: ({ contract }) => {
        return contract ? container.model.contractTable().where('id', contract).first() : null;
      },
    },
    token: {
      type: GraphQLNonNull(WalletType),
      resolve: ({ token }) => {
        return container.model.tokenTable().where('id', token).first();
      },
    },
  },
});

export const OnTokenMetricUpdated: GraphQLFieldConfig<
  { id: string; wallet: string; contract: string | null; token: string },
  Request
> = {
  type: GraphQLNonNull(TokenMetricUpdatedEvent),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnTokenMetricUpdatedFilterInputType',
        fields: {
          token: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          contract: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          wallet: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
          user: {
            type: GraphQLList(GraphQLNonNull(UuidType)),
          },
        },
      }),
      defaultValue: {},
    },
  },
  subscribe: withFilter(
    () =>
      asyncify((callback) =>
        Promise.resolve(
          container.cacheSubscriber('defihelper:channel:onTokenMetricUpdated').onJSON(callback),
        ),
      ),
    async ({ wallet: walletId, contract, token }, { filter }) => {
      let result = true;
      if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
        result = result && filter.wallet.includes(walletId);
      }
      if (Array.isArray(filter.contract)) {
        if (filter.contract.length > 0) {
          result = result && filter.contract.includes(contract);
        } else {
          result = result && contract === null;
        }
      }
      if (Array.isArray(filter.token) && filter.token.length > 0) {
        result = result && filter.token.includes(token);
      }
      if (Array.isArray(filter.user) && filter.user.length > 0) {
        const wallet = await container.model.walletTable().where('id', walletId).first();
        if (!wallet) return false;

        result = result && filter.user.includes(wallet.user);
      }

      return result;
    },
  ),
  resolve: (event) => event,
};
