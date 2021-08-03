import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import container from '@container';
import { utils } from 'ethers';
import { Request } from 'express';
import { User, Role } from '@models/User/Entity';
import { Wallet } from '@models/Wallet/Entity';
import { Blockchain } from '@models/types';
import * as WavesCrypto from '@waves/ts-lib-crypto';
import * as WavesMarshall from '@waves/marshall';
import { AuthenticationError } from 'apollo-server-express';
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
    stable: {
      type: GraphQLBoolean,
      description: 'Is stable token',
    },
  },
});

export const WalletType = new GraphQLObjectType<Wallet>({
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
    address: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Address',
    },
    publicKey: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Public key',
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
                const { id, stable } = filter.tokenAlias;
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
                          if (typeof stable === 'boolean') {
                            this.where('stable', stable);
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
    [Role.User]: {
      description: 'User',
    },
    [Role.Admin]: {
      description: 'Administrator',
    },
  },
});

const blockchainNameMap = new Map([
  ['ethereum:1', 'Ethereum'],
  ['ethereum:56', 'Binance Smart Chain'],
  ['waves:main', 'Waves'],
]);

export const LocaleEnum = new GraphQLEnumType({
  name: 'LocaleEnum',
  values: Object.keys(locales).reduce(
    (res, locale) => ({ ...res, [locale]: { value: locale } }),
    {},
  ),
});

export const UserType = new GraphQLObjectType<User>({
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
        let select = container.model.walletTable().where('user', user.id);
        if (filter.blockchain) {
          const { protocol, network } = filter.blockchain;
          select = select.andWhere('blockchain', protocol);
          if (network !== undefined) {
            select = select.andWhere('network', network);
          }
        }
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
    blockchains: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserBlockchainType))),
      resolve: async (user) => {
        const blockchains = await container.model
          .walletTable()
          .column('blockchain')
          .column('network')
          .where('user', user.id)
          .groupBy('blockchain', 'network');

        return blockchains.map(({ blockchain, network }) => {
          const key = `${blockchain}:${network}`;
          return {
            blockchain,
            network,
            name: blockchainNameMap.get(key) ?? key,
            user,
          };
        });
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
          });

        return metricsChartSelector(
          container.model
            .metricWalletTable()
            .where(function () {
              this.whereIn('wallet', walletSelect);
              if (filter.contract) {
                this.whereIn('contract', filter.contract);
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
                const { id, stable } = filter.tokenAlias;
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
                          if (typeof stable === 'boolean') {
                            this.where('stable', stable);
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
      .create(user, 'ethereum', network, recoveredAddress, recoveredPubKey);
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
      .create(user, 'waves', network, recoveredAddress, publicKey);
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

    await container.model.walletService().create(currentUser, blockchain, network, address, '');
    const sid = container.model.sessionService().generate(currentUser);

    return { currentUser, sid };
  }),
};
