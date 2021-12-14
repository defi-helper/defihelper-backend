import { AuthenticationError, UserInputError } from 'apollo-server-express';
import container from '@container';
import { Request } from 'express';
import { Token, TokenAlias, TokenAliasLiquidity, tokenTableName } from '@models/Token/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';

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
import { metricWalletTokenTableName } from '@models/Metric/Entity';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  onlyAllowed,
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

export const TokenUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TokenType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'TokenUpdateInputType',
          fields: {
            alias: {
              type: UuidType,
              description: 'Token alias ID',
            },
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            symbol: {
              type: GraphQLString,
              description: 'Symbol',
            },
            decimals: {
              type: GraphQLInt,
              description: 'Decimals',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('token.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const token = await container.model.tokenTable().where('id', id).first();
    if (!token) throw new UserInputError('Token not found');

    const { alias: tokenAliasId, name, symbol, decimals } = input;
    let alias;
    if (typeof tokenAliasId === 'string') {
      const tokenAlias = await container.model.tokenAliasTable().where('id', tokenAliasId).first();
      if (!tokenAlias) throw new UserInputError('Token alias not found');
      alias = tokenAlias.id;
    } else {
      alias = token.alias;
    }

    const updated = await container.model.tokenService().update({
      ...token,
      alias,
      name: typeof name === 'string' ? name : token.name,
      symbol: typeof symbol === 'string' ? symbol : token.symbol,
      decimals: typeof decimals === 'number' ? decimals : token.decimals,
    });

    return updated;
  }),
};

export const TokenAliasLiquidityEnum = new GraphQLEnumType({
  name: 'TokenAliasLiquidityEnum',
  values: Object.values(TokenAliasLiquidity).reduce(
    (prev, name) => ({ ...prev, [name]: { value: name } }),
    {},
  ),
});

export const TokenAliasMetricType = new GraphQLObjectType({
  name: 'TokenAliasMetricType',
  fields: {
    myBalance: {
      type: GraphQLNonNull(GraphQLString),
    },
    myUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
    myPortfolioPercent: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

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
    logoUrl: {
      type: GraphQLString,
      description: 'Logo url',
    },
    liquidity: {
      type: GraphQLNonNull(TokenAliasLiquidityEnum),
      description: 'Token liquidity',
    },
    metric: {
      type: GraphQLNonNull(TokenAliasMetricType),
      resolve: async (tokenAlias, args, { currentUser }) => {
        const emptyMetric = {
          myBalance: '0',
          myUSD: '0',
          myPortfolioPercent: '0',
        };
        if (!currentUser) {
          return emptyMetric;
        }

        const database = container.database();
        const metric = await container
          .database()
          .sum({ myBalance: 'balance', myUSD: 'usd' })
          .from(
            container.model
              .metricWalletTokenTable()
              .distinctOn(
                `${metricWalletTokenTableName}.wallet`,
                `${metricWalletTokenTableName}.contract`,
                `${metricWalletTokenTableName}.token`,
              )
              .columns([
                database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS usd`),
                database.raw(
                  `(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`,
                ),
              ])
              .innerJoin(`${tokenTableName} AS t`, 't.id', `${metricWalletTokenTableName}.token`)
              .innerJoin(
                `${walletTableName} AS wlt`,
                `${metricWalletTokenTableName}.wallet`,
                'wlt.id',
              )
              .whereRaw(
                `(${metricWalletTokenTableName}.data->>'usd' IS NOT NULL OR ${metricWalletTokenTableName}.data->>'balance' IS NOT NULL)`,
              )
              .andWhere('t.alias', tokenAlias.id)
              .andWhere('wlt.user', currentUser.id)
              .orderBy(`${metricWalletTokenTableName}.wallet`)
              .orderBy(`${metricWalletTokenTableName}.contract`)
              .orderBy(`${metricWalletTokenTableName}.token`)
              .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
              .as('metric'),
          )
          .first();

        if (!metric) {
          return emptyMetric;
        }

        return {
          myBalance: metric.myBalance || '0',
          myUSD: metric.myUSD || '0',
          myPortfolioPercent: 0,
        };
      },
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
          liquidity: {
            type: TokenAliasLiquidityEnum,
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
      if (filter.liquidity !== undefined) {
        this.andWhere('liquidity', filter.liquidity);
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

export const TokenAliasCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TokenAliasType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'TokenAliasCreateInputType',
          fields: {
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            symbol: {
              type: GraphQLString,
              description: 'Symbol',
            },
            liquidity: {
              type: TokenAliasLiquidityEnum,
              description: 'Token liquidity',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('tokenAlias.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { name, symbol, liquidity } = input;
    const created = await container.model.tokenAliasService().create(name, symbol, liquidity, null);

    return created;
  }),
};

export const TokenAliasUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TokenAliasType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'TokenAliasUpdateInputType',
          fields: {
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            symbol: {
              type: GraphQLString,
              description: 'Symbol',
            },
            liquidity: {
              type: TokenAliasLiquidityEnum,
              description: 'Token liquidity',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('tokenAlias.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const tokenAlias = await container.model.tokenAliasTable().where('id', id).first();
    if (!tokenAlias) throw new UserInputError('Token alias not found');

    const { name, symbol, liquidity } = input;
    const updated = await container.model.tokenAliasService().update({
      ...tokenAlias,
      name: typeof name === 'string' ? name : tokenAlias.name,
      symbol: typeof symbol === 'string' ? symbol : tokenAlias.symbol,
      liquidity:
        typeof liquidity === 'string' ? (liquidity as TokenAliasLiquidity) : tokenAlias.liquidity,
    });

    return updated;
  }),
};

export const TokenAliasDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('tokenAlias.delete', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const tokenAlias = await container.model.tokenAliasTable().where('id', id).first();
    if (!tokenAlias) throw new UserInputError('Token alias not found');

    await container.model.tokenAliasService().delete(tokenAlias);

    return true;
  }),
};
