import container from '@container';
import { Request } from 'express';
import { Token, TokenAlias } from '@models/Token/Entity';
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';

export const TokenType = new GraphQLObjectType<Token>({
  name: 'TokenType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    alias: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Token alias id',
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
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    symbol: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Symbol',
    },
    decimals: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Decimals',
    },
  },
});

export const TokenListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('TokenListQuery', GraphQLNonNull(TokenType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'TokenListQueryFilterInputType',
        fields: {
          blockchain: {
            type: BlockchainFilterInputType,
          },
          address: {
            type: GraphQLList(GraphQLNonNull(GraphQLString)),
          },
          search: {
            type: GraphQLString,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'TokenListQuerySortInputType',
      ['id', 'name', 'symbol', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('TokenListQueryPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const select = container.model.tokenTable().where(function () {
      if (filter.blockchain !== undefined) {
        const { protocol, network } = filter.blockchain;
        this.where('blockchain', protocol);
        if (network !== undefined) {
          this.andWhere('network', network);
        }
      }
      if (Array.isArray(filter.address) && filter.address.length > 0) {
        this.whereIn('address', filter.address);
      }
      if (filter.search !== undefined && filter.search !== '') {
        this.andWhere('name', 'iLike', `%${filter.search}%`);
      }
    });

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};

export const TokenAliasType = new GraphQLObjectType<TokenAlias>({
  name: 'TokenAlias',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    symbol: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Symbol',
    },
    stable: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is stable price',
    },
    tokens: {
      type: GraphQLNonNull(PaginateList('TokenListType', GraphQLNonNull(TokenType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'TokenListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainFilterInputType,
              },
              address: {
                type: GraphQLList(GraphQLNonNull(GraphQLString)),
              },
              search: {
                type: GraphQLString,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'TokenListSortInputType',
          ['id', 'name', 'symbol', 'address', 'createdAt'],
          [{ column: 'name', order: 'asc' }],
        ),
        pagination: PaginationArgument('TokenListPaginationInputType'),
      },
      resolve: async (alias, { filter, sort, pagination }) => {
        const select = container.model
          .tokenTable()
          .where('alias', alias.id)
          .andWhere(function () {
            if (filter.blockchain !== undefined) {
              const { protocol: blockchain, network } = filter.blockchain;
              this.andWhere('blockchain', blockchain);
              if (network !== undefined) {
                this.andWhere('network', network);
              }
            }
            if (Array.isArray(filter.address) && filter.address.length > 0) {
              this.whereIn('address', filter.address);
            }
            if (filter.search !== undefined && filter.search !== '') {
              this.andWhere('name', 'iLike', `%${filter.search}%`);
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
  },
});

export const TokenAliasQuery: GraphQLFieldConfig<any, Request> = {
  type: TokenAliasType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'TokenAliasFilterInputType',
          fields: {
            id: {
              type: GraphQLNonNull(GraphQLString),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }) => {
    return container.model.tokenAliasTable().where('id', filter.id).first();
  },
};

export const TokenAliasListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('TokenAliasListQuery', GraphQLNonNull(TokenAliasType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'TokenAliasListFilterInputType',
        fields: {
          blockchain: {
            type: BlockchainFilterInputType,
          },
          stable: {
            type: GraphQLBoolean,
          },
          symbol: {
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
      'TokenAliasListSortInputType',
      ['id', 'name', 'symbol', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('TokenAliasListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const select = container.model.tokenAliasTable().where(function () {
      if (filter.blockchain !== undefined) {
        const { protocol, network } = filter.blockchain;
        const tokenSelect = container.model
          .tokenTable()
          .columns('alias')
          .where(function () {
            this.where('blockchain', protocol);
            if (network !== undefined) {
              this.andWhere('network', network);
            }
          });
        this.whereIn('id', tokenSelect);
      }
      if (filter.stable !== undefined) {
        this.andWhere('stable', filter.stable);
      }
      if (filter.symbol !== undefined) {
        this.andWhere('symbol', filter.symbol);
      }
      if (filter.search !== undefined && filter.search !== '') {
        this.andWhere('name', 'iLike', `%${filter.search}%`);
      }
    });

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};
