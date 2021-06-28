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
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  MetricChartType,
  MetricColumnType,
  MetricGroupEnum,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';
import container from '@container';
import { utils } from 'ethers';
import { Request } from 'express';
import { ContractType } from '../protocol';
import { User, Role } from '@models/User/Entity';
import { Wallet } from '@models/Wallet/Entity';

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
        const linkSelect = container.model
          .walletContractLinkTable()
          .columns('contract')
          .where('wallet', wallet.id);
        let select = container.model.contractTable().where('id', linkSelect);
        if (filter.blockchain !== undefined) {
          const { protocol, network } = filter.blockchain;
          select = select.andWhere('blockchain', protocol);
          if (network !== undefined) {
            select = select.andWhere('network', network);
          }
        }
        if (filter.hidden !== undefined) {
          select = select.andWhere('hidden', filter.hidden);
        }
        if (filter.search !== undefined && filter.search !== '') {
          select = select.andWhere((select) => {
            select
              .where('name', 'iLike', `%${filter.search}%`)
              .orWhere('address', 'iLike', `%${filter.search}%`);
          });
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
        let select = container.model
          .metricWalletTable()
          .column(database.raw(`DATE_TRUNC('${group}', "createdAt") AS "date"`))
          .column(database.raw(`COUNT((data->'${metric}'->>'v')::numeric) AS "count"`))
          .column(database.raw(`SUM((data->'${metric}'->>'v')::numeric) AS "sum"`))
          .column(database.raw(`AVG((data->'${metric}'->>'v')::numeric) AS "avg"`))
          .column(database.raw(`MAX((data->'${metric}'->>'v')::numeric) AS "max"`))
          .column(database.raw(`MIN((data->'${metric}'->>'v')::numeric) AS "min"`))
          .where('wallet', wallet.id)
          .groupBy('date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
        if (filter.contract) {
          select = select.whereIn('contract', filter.contract);
        }
        if (filter.dateAfter) {
          select = select.andWhere('createdAt', '>=', filter.dateAfter.toDate());
        }
        if (filter.dateBefore) {
          select = select.andWhere('createdAt', '<', filter.dateBefore.toDate());
        }

        return await select;
      },
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
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
    wallets: {
      type: GraphQLNonNull(PaginateList('WalletListType', GraphQLNonNull(WalletType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainEnum,
              },
              network: {
                type: GraphQLString,
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
        if (filter.blockchain !== undefined) {
          select = select.andWhere('blockchain', filter.blockchain);
        }
        if (filter.network !== undefined) {
          select = select.andWhere('network', filter.network);
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
        const walletSelect = container.model.walletTable().columns('id').where('user', user.id);

        const database = container.database();
        let select = container.model
          .metricWalletTable()
          .column(database.raw(`DATE_TRUNC('${group}', "createdAt") AS "date"`))
          .column(database.raw(`COUNT((data->'${metric}'->>'v')::numeric) AS "count"`))
          .column(database.raw(`SUM((data->'${metric}'->>'v')::numeric) AS "sum"`))
          .column(database.raw(`AVG((data->'${metric}'->>'v')::numeric) AS "avg"`))
          .column(database.raw(`MAX((data->'${metric}'->>'v')::numeric) AS "max"`))
          .column(database.raw(`MIN((data->'${metric}'->>'v')::numeric) AS "min"`))
          .whereIn('wallet', walletSelect)
          .groupBy('date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
        if (filter.contract) {
          select = select.whereIn('contract', filter.contract);
        }
        if (filter.wallet) {
          select = select.whereIn('wallet', filter.wallet);
        }
        if (filter.dateAfter) {
          select = select.andWhere('createdAt', '>=', filter.dateAfter.toDate());
        }
        if (filter.dateBefore) {
          select = select.andWhere('createdAt', '<', filter.dateBefore.toDate());
        }

        return await select;
      },
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
    } else {
      const user = currentUser ?? (await container.model.userService().create(Role.User));
      await container.model
        .walletService()
        .create(user, 'ethereum', network, recoveredAddress, recoveredPubKey);
      const sid = container.model.sessionService().generate(user);

      return { user, sid };
    }
  },
};
