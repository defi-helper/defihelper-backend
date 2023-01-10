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
import ccxt, { AuthenticationError as ccxtAuthenticationError } from 'ccxt';
import container from '@container';
import { utils } from 'ethers';
import { Request } from 'express';
import { Locale } from '@services/I18n/container';
import { Role, User } from '@models/User/Entity';
import * as Wallet from '@models/Wallet/Entity';
import {
  walletExchangeTableName,
  walletTableName,
  walletBlockchainTableName,
  WalletSuspenseReason,
} from '@models/Wallet/Entity';
import { Blockchain } from '@models/types';
import BN from 'bignumber.js';
import * as WavesCrypto from '@waves/ts-lib-crypto';
import * as WavesMarshall from '@waves/marshall';
import { AuthenticationError, UserInputError, ForbiddenError } from 'apollo-server-express';
import {
  TokenAliasLiquidityEnum,
  TokenAliasStakedStatisticsType,
  TokenAliasType,
} from '@api/schema/token';
import {
  metricWalletRegistryTableName,
  metricWalletTokenRegistryTableName,
  RegistryPeriod,
  UserCollectorStatus,
} from '@models/Metric/Entity';
import {
  TokenAlias,
  TokenAliasLiquidity,
  tokenAliasTableName,
  tokenTableName,
} from '@models/Token/Entity';
import {
  contractBlockchainTableName,
  contractTableName,
  contractTableName as protocolContractTableName,
} from '@models/Protocol/Entity';
import dayjs from 'dayjs';
import { ContactStatus } from '@models/Notification/Entity';
import { ContractType } from '../protocol';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  MetricChangeType,
  MetricChartType,
  MetricColumnType,
  MetricGroupEnum,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
  WalletBlockchainTypeEnum,
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
    usdChange: {
      type: GraphQLNonNull(MetricChangeType),
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
      resolve: async ({ wallet, tokenAlias }, args, { dataLoader }) => {
        const tokenMetric = await dataLoader
          .walletTokenMetric({ tokenAlias: { id: [tokenAlias.id] } })
          .load(wallet.id);

        return {
          balance: tokenMetric.balance,
          usd: tokenMetric.usd,
          usdChange: {
            day:
              Number(tokenMetric.usdDayBefore) !== 0
                ? new BN(tokenMetric.usd).div(tokenMetric.usdDayBefore).toString(10)
                : '0',
          },
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
    stakedUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    earnedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    earnedUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    balance: {
      type: GraphQLNonNull(GraphQLString),
    },
    usd: {
      type: GraphQLNonNull(GraphQLString),
    },
    usdChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    worth: {
      type: GraphQLNonNull(GraphQLString),
    },
    worthChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
  },
});

export const WalletBlockchainType: GraphQLObjectType = new GraphQLObjectType<
  Wallet.Wallet & Wallet.WalletBlockchain,
  Request
>({
  name: 'WalletBlockchainType',
  fields: () => ({
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    type: {
      type: GraphQLNonNull(WalletBlockchainTypeEnum),
      description: 'Type',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
      resolve: (wallet) => {
        if (wallet.name !== '') return wallet.name;

        return `${wallet.address.slice(0, 5)}...${wallet.address.slice(-5)}`;
      },
    },
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
      description: 'Blockchain type',
    },
    network: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Blockchain network id',
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address',
    },
    publicKey: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Public key',
    },
    statisticsCollectedAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Statistics collected',
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
        const select = container.model
          .contractTable()
          .innerJoin(
            contractBlockchainTableName,
            `${contractBlockchainTableName}.id`,
            `${contractTableName}.id`,
          )
          .where(function () {
            this.whereIn(
              `${contractTableName}.id`,
              container.model
                .walletContractLinkTable()
                .columns('contract')
                .where('wallet', wallet.id),
            );
            if (filter.blockchain !== undefined) {
              const { protocol, network } = filter.blockchain;
              this.andWhere(`${contractBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${contractBlockchainTableName}.network`, network);
              }
            }
            if (filter.protocol !== undefined) {
              this.whereIn(`${contractTableName}.protocol`, filter.protocol);
            }
            if (filter.hidden !== undefined) {
              this.andWhere(`${contractTableName}.hidden`, filter.hidden);
            }
            if (filter.search !== undefined && filter.search !== '') {
              this.andWhere(function () {
                this.where(`${contractTableName}.name`, 'iLike', `%${filter.search}%`);
                this.orWhere(
                  `${contractBlockchainTableName}.address`,
                  'iLike',
                  `%${filter.search}%`,
                );
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
            count: await select.clone().clearSelect().count().first(),
          },
        };
      },
    },
    automates: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(WalletBlockchainType))),
      resolve: async (wallet, args, { dataLoader }) => {
        return dataLoader.walletAutomates().load(wallet.id);
      },
    },
    triggersCount: {
      type: GraphQLNonNull(GraphQLInt),
      resolve: ({ id }, args, { dataLoader }) => {
        return dataLoader.walletTriggersCount().load(id);
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
          .metricWalletTokenRegistryTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(
            tokenTableName,
            `${tokenTableName}.id`,
            `${metricWalletTokenRegistryTableName}.token`,
          )
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest);
            this.whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
              dayjs().add(-1, 'day').startOf('day').toDate(),
              dayjs().add(1, 'day').startOf('day').toDate(),
            ]);
            this.where(`${metricWalletTokenRegistryTableName}.wallet`, wallet.id);
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
          .metricWalletRegistryTable()
          .column(
            database.raw(`(${metricWalletRegistryTableName}.data->>'${metric}')::numeric AS value`),
          )
          .column('date')
          .where(function () {
            this.where(`${metricWalletRegistryTableName}.period`, group);
            this.where(`${metricWalletRegistryTableName}.wallet`, wallet.id);
            this.where(
              database.raw(`${metricWalletRegistryTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.contract) && filter.contract.length > 0) {
              this.whereIn(`${metricWalletRegistryTableName}.contract`, filter.contract);
            }
            if (filter.dateAfter) {
              this.where(`${metricWalletRegistryTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.where(`${metricWalletRegistryTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletRegistryTableName}.date`, 'DESC');

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
        const select = container.model
          .metricWalletTokenRegistryTable()
          .column(
            database.raw(
              `(${metricWalletTokenRegistryTableName}.data->>'${metric}')::numeric AS value`,
            ),
          )
          .column('date')
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenRegistryTableName}.wallet`,
          )
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, group);
            this.where(`${metricWalletTokenRegistryTableName}.wallet`, wallet.id);
            this.whereNull(`${walletTableName}.deletedAt`);
            this.where(
              database.raw(`${metricWalletTokenRegistryTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenRegistryTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenRegistryTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.where(
                `${metricWalletTokenRegistryTableName}.date`,
                '>=',
                filter.dateAfter.toDate(),
              );
            }
            if (filter.dateBefore) {
              this.where(
                `${metricWalletTokenRegistryTableName}.date`,
                '<',
                filter.dateBefore.toDate(),
              );
            }
          })
          .orderBy(`${metricWalletTokenRegistryTableName}.date`, 'DESC');
        if (filter) {
          if (filter.tokenAlias) {
            select
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenRegistryTableName}.token`,
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
        const worth = new BN(walletMetric.stakingUSD)
          .plus(walletMetric.earnedUSD)
          .plus(tokenMetric.usd);
        const worthDayBefore = new BN(walletMetric.stakingUSDDayBefore)
          .plus(walletMetric.earnedUSDDayBefore)
          .plus(tokenMetric.usdDayBefore);

        return {
          stakedUSD: walletMetric.stakingUSD,
          stakedUSDChange: {
            day:
              Number(walletMetric.stakingUSDDayBefore) !== 0
                ? new BN(walletMetric.stakingUSD).div(walletMetric.stakingUSDDayBefore).toString(10)
                : '0',
          },
          earnedUSD: walletMetric.earnedUSD,
          earnedUSDChange: {
            day:
              Number(walletMetric.earnedUSDDayBefore) !== 0
                ? new BN(walletMetric.earnedUSD).div(walletMetric.earnedUSDDayBefore).toString(10)
                : '0',
          },
          balance: tokenMetric.balance,
          usd: tokenMetric.usd,
          usdChange: {
            day:
              Number(tokenMetric.usdDayBefore) !== 0
                ? new BN(tokenMetric.usd).div(tokenMetric.usdDayBefore).toString(10)
                : '0',
          },
          worth: worth.toString(10),
          worthChange: {
            day: worthDayBefore.gt(0) ? worth.div(worthDayBefore).toString(10) : '0',
          },
        };
      },
    },
    billing: {
      type: GraphQLNonNull(WalletBillingType),
      resolve: (wallet) => wallet,
    },
    deletedAt: {
      type: DateTimeType,
      description: 'Date of deleted wallet',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created wallet',
    },
  }),
});

export const WalletExchangeTypeEnum = new GraphQLEnumType({
  name: 'WalletExchangeTypeEnum',
  values: Object.values(Wallet.WalletExchangeType).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const WalletExchangeType = new GraphQLObjectType<
  Wallet.Wallet & Wallet.WalletExchange,
  Request
>({
  name: 'WalletExchangeType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identifier',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    exchange: {
      type: GraphQLNonNull(WalletExchangeTypeEnum),
      description: 'Exchange type',
    },
    isExpired: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: (wallet) => wallet.suspendReason === WalletSuspenseReason.CexUnableToAuthorize,
    },
    statisticsCollectedAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Statistics collected',
    },
    tokenAliases: {
      type: GraphQLNonNull(
        PaginateList('WalletExchangeTokenAliasListType', GraphQLNonNull(WalletTokenAliasType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletExchangeTokenAliasListFilterInputType',
            fields: {
              liquidity: {
                type: GraphQLList(GraphQLNonNull(TokenAliasLiquidityEnum)),
                description: 'Liquidity token',
              },
            },
          }),
          defaultValue: {},
        },
        pagination: PaginationArgument('WalletExchangeTokenAliasListPaginationInputType'),
      },
      resolve: async (wallet, { filter, pagination }) => {
        const select = container.model
          .metricWalletTokenRegistryTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(
            tokenTableName,
            `${tokenTableName}.id`,
            `${metricWalletTokenRegistryTableName}.token`,
          )
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest);
            this.whereBetween(`${metricWalletRegistryTableName}.date`, [
              dayjs().add(-1, 'day').startOf('day').toDate(),
              dayjs().add(1, 'day').startOf('day').toDate(),
            ]);
            this.where(`${metricWalletTokenRegistryTableName}.wallet`, wallet.id);
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
    balance: {
      type: GraphQLNonNull(GraphQLString),
      resolve: async (walletExchange, args, { dataLoader }) => {
        const v = await dataLoader
          .walletTokenMetric({
            tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
          })
          .load(walletExchange.id);

        return new BN(v.usd).toString(10);
      },
    },
    account: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Account',
      resolve: (walletExchange) => {
        const payload = container.cryptography().decryptJson(walletExchange.payload);

        if (!payload?.apiKey) {
          return '';
        }

        return `${payload.apiKey.slice(0, 10)}...${payload.apiKey.slice(-4)}`;
      },
    },
    deletedAt: {
      type: DateTimeType,
      description: 'Date of deleted wallet',
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
        PaginateList('UserBlockchainWalletListType', GraphQLNonNull(WalletBlockchainType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserBlockchainWalletListFilterInputType',
            fields: {
              search: {
                type: GraphQLString,
              },
              deleted: {
                type: GraphQLBoolean,
                description: 'Is wallet deleted',
              },
            },
          }),
          defaultValue: {
            deleted: false,
          },
        },
        sort: SortArgument(
          'UserBlockchainWalletListSortInputType',
          ['id', 'address', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserBlockchainWalletListPaginationInputType'),
      },
      resolve: async ({ user, blockchain, network }, { filter, sort, pagination }) => {
        const select = container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id)
              .andWhere(`${walletExchangeTableName}.blockchain`, blockchain)
              .andWhere(`${walletExchangeTableName}.network`, network);
            if (filter.search !== undefined && filter.search !== '') {
              this.andWhere(`${walletExchangeTableName}.address`, 'iLike', `%${filter.search}%`);
            }
            if (typeof filter.deleted === 'boolean') {
              if (filter.deleted) this.whereNotNull(`${walletTableName}.deletedAt`);
              else this.whereNull(`${walletTableName}.deletedAt`);
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
          .metricWalletTokenRegistryTable()
          .column(
            database.raw(
              `(${metricWalletTokenRegistryTableName}.data->>'${metric}')::numeric AS value`,
            ),
          )
          .column('date')
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenRegistryTableName}.wallet`,
          )
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, group);
            this.where(`${walletTableName}.user`, user.id);
            this.where(`${walletBlockchainTableName}.blockchain`, blockchain);
            this.where(`${walletBlockchainTableName}.network`, network);
            this.whereNull(`${walletTableName}.deletedAt`);
            this.where(
              database.raw(`${metricWalletTokenRegistryTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenRegistryTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenRegistryTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(
                `${metricWalletTokenRegistryTableName}.date`,
                '>=',
                filter.dateAfter.toDate(),
              );
            }
            if (filter.dateBefore) {
              this.andWhere(
                `${metricWalletTokenRegistryTableName}.date`,
                '<',
                filter.dateBefore.toDate(),
              );
            }
          })
          .orderBy(`${metricWalletTokenRegistryTableName}.date`, 'DESC');
        if (filter) {
          if (filter.tokenAlias) {
            select = select
              .innerJoin(
                tokenTableName,
                `${tokenTableName}.id`,
                `${metricWalletTokenRegistryTableName}.token`,
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
  values: Object.values(Role).reduce(
    (res, locale) => ({ ...res, [locale]: { value: locale } }),
    {},
  ),
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
    balanceUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    stakedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    stakedUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    earnedUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    earnedUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    worth: {
      type: GraphQLNonNull(GraphQLString),
    },
    worthChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    apy: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const UserReferrerCodeType = new GraphQLObjectType({
  name: 'UserReferrerCodeType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    code: {
      type: GraphQLNonNull(GraphQLString),
    },
    usedTimes: {
      type: GraphQLNonNull(GraphQLInt),
    },
    visits: {
      type: GraphQLNonNull(GraphQLInt),
    },
    redirectTo: {
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
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'User portfolio name',
    },
    locale: {
      type: GraphQLNonNull(LocaleEnum),
      description: 'Current user locale',
    },
    timezone: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Current user timezone',
    },
    isPorfolioCollected: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is portfolio collected',
      resolve: async (user) => {
        const cacheKey = await container
          .cache()
          .promises.get(`defihelper:portfolio-preload:${user.id}`)
          .catch(() => null);

        if (cacheKey === null) {
          const collector = await container.model
            .metricUserCollectorTable()
            .where('user', user.id)
            .where('status', UserCollectorStatus.Pending)
            .first();
          // Skip if the collection of metrics is already in progress
          if (!collector) {
            container.model
              .queueService()
              .push(
                'metricsUserPortfolioFiller',
                { userId: user.id, priority: 9, notify: false },
                { priority: 9 },
              );
          }
          container.cache().promises.setex(
            `defihelper:portfolio-preload:${user.id}`,
            3600, // 1 hour
            'true',
          );
        }

        return user.isPorfolioCollected;
      },
    },
    portfolioCollectingFreezedAt: {
      type: DateTimeType,
      description: 'When portfolio collecting (will be/was) freezed',
      resolve: async (user) => {
        const [row] = await container.model.userContactTable().count().where({
          user: user.id,
          status: ContactStatus.Active,
        });

        const numberOfContacts = new BN(row?.count ?? 0);
        if (!numberOfContacts.isZero()) {
          return null;
        }

        return dayjs(user.createdAt).add(7, 'days');
      },
    },
    tokenAliasesStakedMetrics: {
      type: GraphQLNonNull(
        PaginateList(
          'UserTokenAliasesStakedMetricsListType',
          GraphQLNonNull(TokenAliasStakedStatisticsType),
        ),
      ),
      args: {
        filter: {
          type: GraphQLNonNull(
            new GraphQLInputObjectType({
              name: 'UserTokenAliasesStakedMetricsListFilterInputType',
              fields: {
                liquidity: {
                  type: GraphQLList(GraphQLNonNull(TokenAliasLiquidityEnum)),
                  description: 'Liquidity token',
                },
                protocol: {
                  type: GraphQLNonNull(UuidType),
                  description: 'Target protocol',
                },
              },
            }),
          ),
        },
        pagination: PaginationArgument('UserTokenAliasesStakedMetricsListPaginationInputType'),
      },
      resolve: async (user, { filter, pagination }) => {
        const select = container.model
          .metricWalletTokenRegistryTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(
            tokenTableName,
            `${tokenTableName}.id`,
            `${metricWalletTokenRegistryTableName}.token`,
          )
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenRegistryTableName}.wallet`,
          )
          .innerJoin(
            protocolContractTableName,
            `${protocolContractTableName}.id`,
            `${metricWalletTokenRegistryTableName}.contract`,
          )
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest);
            this.whereBetween(`${metricWalletRegistryTableName}.date`, [
              dayjs().add(-1, 'day').startOf('day').toDate(),
              dayjs().add(1, 'day').startOf('day').toDate(),
            ]);
            this.where(`${protocolContractTableName}.protocol`, filter.protocol);
            this.where(`${walletTableName}.user`, user.id);
            this.whereNull(`${walletTableName}.deletedAt`);
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
            .then((rows) => rows.map((row) => ({ ...row, protocol: filter.protocol }))),
          pagination: {
            count: await select.clone().countDistinct(`${tokenAliasTableName}.id`).first(),
          },
        };
      },
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
        const select = container.model
          .tokenAliasTable()
          .column(`${tokenAliasTableName}.*`)
          .innerJoin(tokenTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .innerJoin(metricWalletTokenRegistryTableName, function () {
            this.on(`${metricWalletTokenRegistryTableName}.token`, `${tokenTableName}.id`);
            this.onIn(`${metricWalletTokenRegistryTableName}.period`, [RegistryPeriod.Latest]);
          })
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenRegistryTableName}.wallet`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            this.whereNull(`${walletTableName}.deletedAt`);
            if (Array.isArray(filter.liquidity) && filter.liquidity.length > 0) {
              this.whereIn(`${tokenAliasTableName}.liquidity`, filter.liquidity);
            }
          })
          .groupBy(`${tokenAliasTableName}.id`);
        if (filter.protocol) {
          select
            .innerJoin(
              protocolContractTableName,
              `${protocolContractTableName}.id`,
              `${metricWalletTokenRegistryTableName}.contract`,
            )
            .where(`${protocolContractTableName}.protocol`, filter.protocol);
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
      type: GraphQLNonNull(PaginateList('WalletListType', GraphQLNonNull(WalletBlockchainType))),
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
                type: WalletBlockchainTypeEnum,
              },
              search: {
                type: GraphQLString,
              },
              deleted: {
                type: GraphQLBoolean,
                description: 'Is wallet deleted',
              },
            },
          }),
          defaultValue: {
            deleted: false,
          },
        },
        sort: SortArgument(
          'WalletListSortInputType',
          ['id', 'address', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            const { id, blockchain, type, search, deleted } = filter;
            if (id) {
              this.andWhere(`${walletTableName}.id`, id);
            }
            if (blockchain) {
              const { protocol, network } = blockchain;
              this.andWhere(`${walletBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${walletBlockchainTableName}.network`, network);
              }
            }
            if (type) {
              this.andWhere(`${walletBlockchainTableName}.type`, type);
            }
            if (search !== undefined && search !== '') {
              this.andWhere(`${walletBlockchainTableName}.address`, 'iLike', `%${search}%`);
            }
            if (typeof deleted === 'boolean') {
              if (deleted) this.whereNotNull(`${walletTableName}.deletedAt`);
              else this.whereNull(`${walletTableName}.deletedAt`);
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
    exchanges: {
      type: GraphQLNonNull(
        PaginateList('WalletExchangeListType', GraphQLNonNull(WalletExchangeType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletExchangexListFilterInputType',
            fields: {
              id: {
                type: UuidType,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletExchangeListSortInputType',
          ['id', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletExchangeListPaginationInputType'),
      },
      resolve: async (user, { sort, pagination, filter }) => {
        const select = container.model
          .walletTable()
          .innerJoin(
            walletExchangeTableName,
            `${walletExchangeTableName}.id`,
            `${walletTableName}.id`,
          )
          .where(`${walletTableName}.user`, user.id)
          .andWhere(function () {
            if (filter.id) {
              this.andWhere(`${walletExchangeTableName}.id`, filter.id);
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
        return blockchains
          .filter((v) => v)
          .map(({ blockchain, network }) => ({
            blockchain,
            network,
            name:
              container.blockchain[blockchain]?.byNetwork(network)?.name ??
              `${blockchain}:${network}`,
            user,
          }));
      },
    },
    referrerCode: {
      type: GraphQLNonNull(UserReferrerCodeType),
      resolve: async (user) => {
        const referrerCode = await container.model
          .referrerCodeTable()
          .where({ user: user.id })
          .orderBy('createdAt')
          .first();

        if (referrerCode) {
          return referrerCode;
        }

        return container.model.referrerCodeService().generate(user);
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
          .metricWalletRegistryTable()
          .column(
            database.raw(`(${metricWalletRegistryTableName}.data->>'${metric}')::numeric AS value`),
          )
          .column('date')
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletRegistryTableName}.wallet`,
          )
          .where(function () {
            this.where(`${metricWalletRegistryTableName}.period`, group);
            this.where(`${walletTableName}.user`, user.id);
            this.whereNull(`${walletTableName}.deletedAt`);
            this.where(
              database.raw(`${metricWalletRegistryTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.where(`${walletBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.where(`${walletBlockchainTableName}.network`, network);
              }
            }
            if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
              this.whereIn(`${metricWalletRegistryTableName}.wallet`, filter.wallet);
            }
            if (Array.isArray(filter.contract) && filter.contract.length > 0) {
              this.whereIn(`${metricWalletRegistryTableName}.contract`, filter.contract);
            }
            if (filter.dateAfter) {
              this.where(`${metricWalletRegistryTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.where(`${metricWalletRegistryTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletRegistryTableName}.date`, 'DESC');

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
        const select = container.model
          .metricWalletTokenRegistryTable()
          .column(
            database.raw(
              `(${metricWalletTokenRegistryTableName}.data->>'${metric}')::numeric AS value`,
            ),
          )
          .column('date')
          .column(`${tokenAliasTableName}.id AS tokenAliasId`)
          .column(`${tokenAliasTableName}.liquidity AS tokenAliasLiquidity`)
          .innerJoin(
            walletTableName,
            `${walletTableName}.id`,
            `${metricWalletTokenRegistryTableName}.wallet`,
          )
          .innerJoin(
            tokenTableName,
            `${tokenTableName}.id`,
            `${metricWalletTokenRegistryTableName}.token`,
          )
          .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
          .where(function () {
            this.where(`${metricWalletTokenRegistryTableName}.period`, group);
            this.where(`${walletTableName}.user`, user.id);
            this.whereNull(`${walletTableName}.deletedAt`);
            this.where(
              database.raw(`${metricWalletTokenRegistryTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.where(`${walletBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.where(`${walletBlockchainTableName}.network`, network);
              }
            }
            if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
              this.whereIn(`${metricWalletTokenRegistryTableName}.wallet`, filter.wallet);
            }
            if (Array.isArray(filter.contract)) {
              if (filter.contract.length > 0) {
                this.whereIn(`${metricWalletTokenRegistryTableName}.contract`, filter.contract);
              } else {
                this.whereNull(`${metricWalletTokenRegistryTableName}.contract`);
              }
            }
            if (filter.dateAfter) {
              this.where(
                `${metricWalletTokenRegistryTableName}.date`,
                '>=',
                filter.dateAfter.toDate(),
              );
            }
            if (filter.dateBefore) {
              this.where(
                `${metricWalletTokenRegistryTableName}.date`,
                '<',
                filter.dateBefore.toDate(),
              );
            }
          })
          .orderBy(`${metricWalletTokenRegistryTableName}.date`, 'DESC');

        return container
          .database()
          .column('date')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .where(function () {
            if (filter.tokenAlias) {
              if (Array.isArray(filter.tokenAlias.id) && filter.tokenAlias.id.length > 0) {
                this.whereIn('tokenAliasId', filter.tokenAlias.id);
              }
              if (
                Array.isArray(filter.tokenAlias.liquidity) &&
                filter.tokenAlias.liquidity.length > 0
              ) {
                this.whereIn('tokenAliasLiquidity', filter.tokenAlias.liquidity);
              }
            }
          })
          .groupBy('date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    metric: {
      type: GraphQLNonNull(UserMetricType),
      resolve: async (user, args, { dataLoader }) => {
        const [walletMetric, tokenMetric] = await Promise.all([
          dataLoader.userMetric().load(user.id),
          dataLoader
            .userTokenMetric({
              contract: null,
              tokenAlias: { liquidity: [TokenAliasLiquidity.Stable, TokenAliasLiquidity.Unstable] },
            })
            .load(user.id),
        ]);
        const worth = new BN(walletMetric.stakingUSD)
          .plus(walletMetric.earnedUSD)
          .plus(tokenMetric.usd);
        const worthDayBefore = new BN(walletMetric.stakingUSDDayBefore)
          .plus(walletMetric.earnedUSDDayBefore)
          .plus(tokenMetric.usdDayBefore);

        return {
          balanceUSD: tokenMetric.usd,
          balanceUSDChange: {
            day:
              Number(tokenMetric.usdDayBefore) !== 0
                ? new BN(tokenMetric.usd).div(tokenMetric.usdDayBefore).toString(10)
                : '0',
          },
          stakedUSD: walletMetric.stakingUSD,
          stakedUSDChange: {
            day:
              Number(walletMetric.stakingUSDDayBefore) !== 0
                ? new BN(walletMetric.stakingUSD).div(walletMetric.stakingUSDDayBefore).toString(10)
                : '0',
          },
          earnedUSD: walletMetric.earnedUSD,
          earnedUSDChange: {
            day:
              Number(walletMetric.earnedUSDDayBefore) !== 0
                ? new BN(walletMetric.earnedUSD).div(walletMetric.earnedUSDDayBefore).toString(10)
                : '0',
          },
          worth: worth.toString(10),
          worthChange: {
            day: worthDayBefore.gt(0)
              ? worth.minus(worthDayBefore).div(worthDayBefore).toString(10)
              : '0',
          },
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
    authAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of last auth',
    },
    isMetricsTracked: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

export const UserReferrerCodeQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(UserReferrerCodeType),
  args: {
    code: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
  resolve: async (root, { code }) => {
    const codeRecord = await container.model.referrerCodeTable().where({ code }).first();
    if (!codeRecord) throw new UserInputError('Code not found');
    container.model.referrerCodeService().visit(codeRecord);

    return codeRecord;
  },
};

export const MeQuery: GraphQLFieldConfig<any, Request> = {
  type: UserType,
  args: {
    input: {
      type: new GraphQLInputObjectType({
        name: 'MeInputType',
        fields: {
          timezone: {
            type: GraphQLString,
            description: 'Timezone',
          },
        },
      }),
    },
  },
  resolve: (root, { input }, { currentUser }) => {
    return currentUser
      ? container.model.userService().update({
          ...currentUser,
          timezone: input?.timezone ?? currentUser.timezone,
          lastSeenAt: new Date(),
        })
      : null;
  },
};

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
          wallet: {
            type: new GraphQLInputObjectType({
              name: 'UserListWalletFilterInputType',
              fields: {
                blockchain: {
                  type: BlockchainFilterInputType,
                },
                type: {
                  type: WalletBlockchainTypeEnum,
                },
                search: {
                  type: GraphQLString,
                },
              },
            }),
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
      const { role, wallet } = filter;
      if (role !== undefined) {
        this.andWhere('role', role);
      }

      if (wallet) {
        const { blockchain, type, search } = wallet;
        this.whereIn(
          'id',
          container.model
            .walletTable()
            .distinct(`${walletTableName}.user`)
            .innerJoin(
              walletBlockchainTableName,
              `${walletTableName}.id`,
              `${walletBlockchainTableName}.id`,
            )
            .where(function () {
              if (blockchain) {
                const { protocol, network } = blockchain;
                this.andWhere(`${walletBlockchainTableName}.blockchain`, protocol);
                if (network !== undefined) {
                  this.andWhere(`${walletBlockchainTableName}.network`, network);
                }
              }
              if (type) {
                this.andWhere(`${walletBlockchainTableName}.type`, type);
              }
              if (search !== undefined && search !== '') {
                this.andWhere(`${walletBlockchainTableName}.address`, 'iLike', `%${search}%`);
              }
            }),
        );
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

export const AuthDemoMutation: GraphQLFieldConfig<any, Request> = {
  type: AuthType,
  resolve: async () => {
    const user = await container.model
      .userTable()
      .where('role', Role.Demo)
      .orderBy('createdAt', 'asc')
      .first();
    if (!user) return null;

    return container.model
      .userService()
      .auth(
        user,
        await container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletBlockchainTableName}.id`,
            `${walletTableName}.id`,
          )
          .where('user', user.id)
          .first(),
      );
  },
};

export const AuthThroughAdminMutation: GraphQLFieldConfig<any, Request> = {
  type: AuthType,
  args: {
    userId: {
      type: GraphQLNonNull(UuidType),
      description: 'Target user id',
    },
  },
  resolve: onlyAllowed('user.login-through', async (root, { userId: id }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const user = await container.model.userTable().where({ id }).first();
    if (!user) {
      throw new UserInputError('User not found');
    }

    return container.model.userService().auth(user);
  }),
};

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
              type: GraphQLString,
              description: 'Message',
            },
            signature: {
              type: GraphQLString,
              description: 'Signed message',
            },
            code: {
              type: GraphQLString,
              description: 'Code',
            },
            timezone: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Timezone',
            },
            merge: {
              type: GraphQLBoolean,
              description: 'Merged target account to current account',
              defaultValue: false,
            },
            locale: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Locale',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    if (currentUser?.role === Role.Demo) {
      throw new ForbiddenError('FORBIDDEN');
    }

    const { network, address, message, signature, merge, code } = input;
    const userService = container.model.userService();

    const codeRecord = code
      ? await container.model.referrerCodeTable().where({ id: code }).first()
      : undefined;

    if (signature === undefined) {
      const duplicateWallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where({
          blockchain: 'ethereum',
          network,
          address: address.toLowerCase(),
        })
        .first();
      if (!duplicateWallet) {
        const user =
          currentUser ??
          (await userService.create(Role.User, input.timezone, codeRecord, input.locale));
        return userService.auth(
          user,
          await container.model
            .walletService()
            .createBlockchainWallet(
              user,
              'ethereum',
              network,
              Wallet.WalletBlockchainType.Wallet,
              address.toLowerCase(),
              '',
              '',
              false,
            ),
        );
      }
      if (currentUser && currentUser.id !== duplicateWallet.user) {
        return null;
      }
      if (!duplicateWallet.confirmed) {
        const user = await container.model.userTable().where('id', duplicateWallet.user).first();
        if (!user) return null;
        return userService.auth(user, duplicateWallet);
      }
    } else if (message === undefined) {
      throw new UserInputError('Invalid signature or message');
    }

    if (typeof message !== 'string' || message.length < 5) return null;
    if (!container.blockchain.ethereum.isNetwork(network)) {
      throw new UserInputError('Network unsupported');
    }
    try {
      dayjs().tz(input.timezone);
    } catch {
      throw new UserInputError('Wrong timezone');
    }

    const hash = utils.hashMessage(message);
    const hashBytes = utils.arrayify(hash);
    const recoveredPubKey = utils.recoverPublicKey(hashBytes, signature);
    const recoveredAddress = utils.recoverAddress(hashBytes, signature).toLowerCase();
    if (address.toLowerCase() !== recoveredAddress) return null;

    const duplicateWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where({
        blockchain: 'ethereum',
        network,
        address: recoveredAddress,
      })
      .first();

    if (duplicateWallet) {
      const user = await container.model.userTable().where('id', duplicateWallet.user).first();
      if (!user) return null;

      if (merge) {
        if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
        await container.model.walletService().changeOwner(duplicateWallet, currentUser);
        return userService.auth(currentUser, duplicateWallet);
      }

      if (user.timezone !== input.timezone) {
        user.timezone = await userService
          .update({
            ...user,
            locale: input.locale,
            timezone: input.timezone,
          })
          .then(({ timezone }) => timezone);
      }

      return userService.auth(user, duplicateWallet);
    }

    const user =
      currentUser ??
      (await userService.create(Role.User, input.timezone, codeRecord, input.locale));
    return userService.auth(
      user,
      await container.model
        .walletService()
        .createBlockchainWallet(
          user,
          'ethereum',
          network,
          Wallet.WalletBlockchainType.Wallet,
          recoveredAddress,
          recoveredPubKey,
          '',
          true,
        ),
    );
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
              type: GraphQLString,
              description: 'Message',
            },
            signature: {
              type: GraphQLString,
              description: 'Signed message',
            },
            code: {
              type: GraphQLString,
              description: 'Promo id',
            },
            timezone: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Timezone',
            },
            locale: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Locale',
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
    if (currentUser?.role === Role.Demo) {
      throw new ForbiddenError('FORBIDDEN');
    }

    const userService = container.model.userService();
    const { network, address, message, publicKey, signature, merge, code } = input;

    const codeRecord = code
      ? await container.model
          .referrerCodeTable()
          .where({
            id: code.id,
          })
          .first()
      : undefined;

    if (signature === undefined) {
      const duplicateWallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where({
          blockchain: 'waves',
          network,
          address,
        })
        .first();
      if (!duplicateWallet) {
        const user =
          currentUser ??
          (await userService.create(Role.User, input.timezone, codeRecord, input.locale));
        return userService.auth(
          user,
          await container.model
            .walletService()
            .createBlockchainWallet(
              user,
              'waves',
              network,
              Wallet.WalletBlockchainType.Wallet,
              address,
              '',
              '',
              false,
            ),
        );
      }
      if (currentUser && currentUser.id !== duplicateWallet.user) {
        return null;
      }
      if (!duplicateWallet.confirmed) {
        const user = await container.model.userTable().where('id', duplicateWallet.user).first();
        if (!user) return null;
        return userService.auth(user, duplicateWallet);
      }
    } else if (message === undefined) {
      throw new UserInputError('Invalid signature or message');
    }

    if (typeof message !== 'string' || message.length < 5) return null;
    try {
      dayjs().tz(input.timezone);
    } catch {
      throw new UserInputError('Wrong timezone');
    }

    const isValidSignature = WavesCrypto.verifySignature(
      publicKey,
      WavesCrypto.concat(
        [255, 255, 255, 1],
        WavesMarshall.serializePrimitives.BASE64_STRING(
          `base64:${Buffer.from(message).toString('base64')}`,
        ),
      ),
      signature,
    );
    const recoveredAddress = WavesCrypto.address({ publicKey }, network === 'test' ? 'T' : 'W');
    if (!isValidSignature || recoveredAddress !== address) return null;

    const duplicateWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where({
        blockchain: 'waves',
        network,
        address: recoveredAddress,
      })
      .first();

    if (duplicateWallet) {
      const user = await container.model.userTable().where('id', duplicateWallet.user).first();
      if (!user) return null;

      if (merge) {
        if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
        await container.model.walletService().changeOwner(duplicateWallet, currentUser);
        return userService.auth(currentUser, duplicateWallet);
      }

      if (user.timezone !== input.timezone) {
        user.timezone = await userService
          .update({
            ...user,
            timezone: input.timezone,
            locale: input.locale,
          })
          .then(({ timezone }) => timezone);
      }

      return userService.auth(user, duplicateWallet);
    }

    const user =
      currentUser ??
      (await userService.create(Role.User, input.timezone, codeRecord, input.locale));
    return userService.auth(
      user,
      await container.model
        .walletService()
        .createBlockchainWallet(
          user,
          'waves',
          network,
          Wallet.WalletBlockchainType.Wallet,
          recoveredAddress,
          publicKey,
          '',
          true,
        ),
    );
  },
};

export const IntegrationExchangeApiConnectMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(WalletExchangeType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'IntegrationExchangeApiConnectInputType',
          fields: {
            objectKeys: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
              description: 'Exchange object keys',
            },
            objectValues: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
              description: 'Exchange object values',
            },
            type: {
              type: GraphQLNonNull(WalletExchangeTypeEnum),
              description: 'Exchange',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('integration.connect', async (root, { input }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const keys: string[] = input.objectKeys;
    const values: string[] = input.objectValues;

    if (keys.length !== values.length) {
      throw new UserInputError('Looks like a bug, keys and values must be the same length');
    }

    const inputObject = keys.reduce<Record<string, string>>(
      (res, _, i) => ({ ...res, [keys[i]]: values[i] }),
      {},
    );

    const exchangeInstance = new ccxt[input.type as Wallet.WalletExchangeType]({
      ...inputObject,

      options: {
        adjustForTimeDifference: true,
      },
    });

    try {
      await exchangeInstance.fetchBalance();
    } catch (e) {
      if (e instanceof ccxtAuthenticationError) {
        throw new UserInputError('Invalid api key pair');
      }

      throw new UserInputError('Unknown exchange-side error');
    }

    const exchangeWallet = await container.model
      .walletService()
      .createExchangeWallet(currentUser, input.type, inputObject);

    return exchangeWallet;
  }),
};

export const IntegrationDisconnectMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('integration.disconnect', async (root, { id }, { currentUser }) => {
    if (!currentUser) {
      throw new AuthenticationError('UNAUTHENTICATED');
    }

    const wallet = await container.model.walletTable().where({ id, user: currentUser.id }).first();
    if (!wallet) throw new UserInputError('Wallet not found');

    await container.model.walletService().deleteExchangeWallet(wallet);

    return true;
  }),
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
      .createBlockchainWallet(
        currentUser,
        blockchain,
        network,
        Wallet.WalletBlockchainType.Wallet,
        address,
        '',
        '',
        false,
      );
    const sid = container.model.sessionService().generate(currentUser);

    return { currentUser, sid };
  }),
};

export const WalletUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(WalletBlockchainType),
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
    const blockchainWallet = await container.model
      .walletBlockchainTable()
      .where('id', wallet.id)
      .first();
    if (!blockchainWallet) throw new UserInputError('Wallet not found');

    const { name } = input;
    const updated = await container.model.walletService().updateBlockchainWallet(
      {
        ...wallet,
        name: typeof name === 'string' ? name : wallet.name,
      },
      blockchainWallet,
    );

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

    await container.model.walletService().deleteBlockchainWallet(wallet);

    return true;
  }),
};

export const WalletUpdateStatisticsMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('wallet.update-own', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const wallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.id`, id)
      .first();
    if (!wallet) throw new UserInputError('Wallet not found');
    if (wallet.user !== currentUser.id) throw new UserInputError('Foreign wallet');
    if (wallet.blockchain !== 'ethereum') return false;
    if (
      container.blockchain.ethereum.byNetwork(wallet.network).testnet &&
      !(container.parent.mode === 'development' && ['5', '43113'].includes(wallet.network))
    ) {
      return false;
    }

    await Promise.all([
      container.model
        .queueService()
        .push('metricsWalletBalancesDeBankFiller', { id }, { topic: 'metricCurrent', priority: 9 }),
      container.model
        .queueService()
        .push(
          'metricsWalletProtocolsBalancesDeBankFiller',
          { id },
          { topic: 'metricCurrent', priority: 9 },
        ),
    ]);

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
            name: {
              type: GraphQLString,
            },
            locale: {
              type: LocaleEnum,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('user.update-own', async (root, { id, input }, { currentUser, acl }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const user = await container.model.userTable().where('id', id).first();
    if (!user) throw new UserInputError('User not found');
    if (currentUser.role !== Role.Admin && currentUser.id !== user.id) {
      throw new UserInputError('Foreign account');
    }

    const { role, name, locale } = input as { role?: Role; name?: string; locale?: Locale };
    const updatedFields = {
      ...user,
      name: name !== undefined ? name : user.name,
      locale: locale !== undefined ? locale : user.locale,
    };
    if (role !== undefined) {
      if (!acl.isAllowed('user', 'update')) throw new ForbiddenError('FORBIDDEN');
      updatedFields.role = role;
    }

    return container.model.userService().update(updatedFields);
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
    txId: {
      type: GraphQLString,
      description: 'Transaction id',
    },
  },
  resolve: onlyAllowed(
    'wallet.metric-scan',
    async (root, { wallet: walletId, contract: contractId, txId }, { currentUser }) => {
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
      await container.model.queueService().push(
        'metricsWalletScanMutation',
        {
          contract: contract.id,
          wallet: wallet.id,
          txId,
        },
        {
          topic: 'metricCurrent',
          priority: 9,
        },
      );

      return true;
    },
  ),
};

export const WalletMetricUpdatedEvent = new GraphQLObjectType({
  name: 'WalletMetricUpdatedEvent',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    wallet: {
      type: GraphQLNonNull(WalletBlockchainType),
      resolve: ({ wallet }) => {
        return container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletTableName}.id`,
            `${walletBlockchainTableName}.id`,
          )
          .where(`${walletTableName}.id`, wallet)
          .first();
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
  type: GraphQLNonNull(WalletBlockchainType),
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
    () => container.cacheSubscriber('defihelper:channel:onWalletCreated').asyncIterator(),
    async ({ id }, { filter }) => {
      if (!filter.user) {
        return false;
      }

      const wallet = await container.model.walletTable().where({ id }).first();
      return !(!wallet || !filter.user.includes(wallet.user));
    },
  ),
  resolve: ({ id }) => {
    return container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletTableName}.id`,
        `${walletBlockchainTableName}.id`,
      )
      .where(`${walletTableName}.id`, id)
      .first();
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
    () => container.cacheSubscriber('defihelper:channel:onWalletMetricUpdated').asyncIterator(),
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
      type: GraphQLNonNull(WalletBlockchainType),
      resolve: ({ wallet }) => {
        return container.model
          .walletTable()
          .innerJoin(
            walletBlockchainTableName,
            `${walletTableName}.id`,
            `${walletBlockchainTableName}.id`,
          )
          .where(`${walletTableName}.id`, wallet)
          .first();
      },
    },
    contract: {
      type: ContractType,
      resolve: ({ contract }) => {
        return contract ? container.model.contractTable().where('id', contract).first() : null;
      },
    },
    token: {
      type: GraphQLNonNull(WalletBlockchainType),
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
      container.cacheSubscriber('defihelper:channel:onWalletTokenMetricUpdated').asyncIterator(),
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
