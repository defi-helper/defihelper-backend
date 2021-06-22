import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import * as User from '@models/User';
import {
  BlockchainEnum,
  DateTimeType,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';
import container from '@container';

export const WalletType = new GraphQLObjectType({
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
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

const { Role } = User.Entity;
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

export const UserType = new GraphQLObjectType<User.Entity.User>({
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
        sort: SortArgument('WalletListSortInputType', ['id', 'address', 'createdAt']),
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
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

export const AuthEthereumInputType = new GraphQLInputObjectType({
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
