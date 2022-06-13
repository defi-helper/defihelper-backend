import { AuthenticationError, UserInputError } from 'apollo-server-express';
import container from '@container';
import { Request } from 'express';
import {
  PriceFeed,
  Token,
  TokenAlias,
  TokenAliasLiquidity,
  tokenTableName,
} from '@models/Token/Entity';
import { walletTableName } from '@models/Wallet/Entity';
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
  GraphQLUnionType,
} from 'graphql';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
import {
  contractBlockchainTableName,
  contractTableName,
  protocolTableName,
} from '@models/Protocol/Entity';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';

export const PriceFeedCoingeckoIdType = new GraphQLObjectType({
  name: 'TokenPriceFeedCoingeckoIdType',
  fields: {
    type: {
      type: GraphQLNonNull(GraphQLString),
    },
    id: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const PriceFeedCoingeckoPlatformEnum = new GraphQLEnumType({
  name: 'TokenPriceFeedCoingeckoPlatformEnum',
  values: Object.values(PriceFeed.CoingeckoPlatform).reduce(
    (res, type) => ({ ...res, [type.replace(/-/g, '_')]: { value: type } }),
    {},
  ),
});

export const PriceFeedCoingeckoAddressType = new GraphQLObjectType({
  name: 'TokenPriceFeedCoingeckoAddressType',
  fields: {
    type: {
      type: GraphQLNonNull(GraphQLString),
    },
    platform: {
      type: GraphQLNonNull(PriceFeedCoingeckoPlatformEnum),
    },
    address: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const PriceFeedType = new GraphQLUnionType({
  name: 'TokenPriceFeedType',
  types: [PriceFeedCoingeckoIdType, PriceFeedCoingeckoAddressType],
  resolveType: (priceFeed) => {
    if (PriceFeed.isCoingeckoId(priceFeed)) {
      return PriceFeedCoingeckoIdType;
    }
    if (PriceFeed.isCoingeckoAddress(priceFeed)) {
      return PriceFeedCoingeckoAddressType;
    }
    throw new Error(`Invalid token price feed "${JSON.stringify(priceFeed)}"`);
  },
});

export const PriceFeedInputType = new GraphQLInputObjectType({
  name: 'TokenPriceFeedInputType',
  fields: {
    coingeckoId: {
      type: new GraphQLInputObjectType({
        name: 'TokenPriceFeedCoingeckoIdInputType',
        fields: {
          id: { type: GraphQLNonNull(GraphQLString) },
        },
      }),
    },
    coingeckoAddress: {
      type: new GraphQLInputObjectType({
        name: 'TokenPriceFeedCoingeckoAddressInputType',
        fields: {
          platform: { type: GraphQLNonNull(PriceFeedCoingeckoPlatformEnum) },
          address: { type: GraphQLNonNull(GraphQLString) },
        },
      }),
    },
  },
});

export const TokenType: GraphQLObjectType = new GraphQLObjectType<Token, Request>({
  name: 'TokenType',
  fields: () => ({
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    alias: {
      type: TokenAliasType,
      description: 'Token alias id',
      resolve: async ({ alias }, _, { dataLoader }) => {
        return alias ? dataLoader.tokenAlias().load(alias) : null;
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
    priceFeed: {
      type: PriceFeedType,
    },
    priceFeedNeeded: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
  }),
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
          tradable: {
            type: GraphQLBoolean,
          },
          tokenAlias: {
            type: UuidType,
          },
          isPriceFeedNedded: {
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
      if (typeof filter.tradable === 'boolean') {
        this.andWhere('tradable', filter.tradable);
      }
      if (typeof filter.isPriceFeedNedded === 'boolean') {
        this.andWhere('priceFeedNeeded', filter.isPriceFeedNedded);
      }
      if (filter.tokenAlias !== undefined) {
        this.andWhere('alias', filter.tokenAlias);
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
            priceFeed: {
              type: PriceFeedInputType,
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

    const { alias: tokenAliasId, name, symbol, decimals, priceFeed } = input;
    let alias;
    if (typeof tokenAliasId === 'string') {
      const tokenAlias = await container.model.tokenAliasTable().where('id', tokenAliasId).first();
      if (!tokenAlias) throw new UserInputError('Token alias not found');
      alias = tokenAlias.id;
    } else {
      alias = token.alias;
    }
    let priceFeedInput = token.priceFeed;
    if (priceFeed) {
      if (priceFeed.coingeckoId) {
        priceFeed.coingeckoId.type = 'coingeckoId';
        if (!PriceFeed.isCoingeckoId(priceFeed.coingeckoId)) {
          throw new UserInputError(`Invalid price feed "${JSON.stringify(priceFeed.coingeckoId)}"`);
        }
        priceFeedInput = priceFeed.coingeckoId;
      } else if (priceFeed.coingeckoAddress) {
        priceFeed.coingeckoAddress.type = 'coingeckoAddress';
        if (!PriceFeed.isCoingeckoAddress(priceFeed.coingeckoAddress)) {
          throw new UserInputError(
            `Invalid price feed "${JSON.stringify(priceFeed.coingeckoAddress)}"`,
          );
        }
        priceFeedInput = priceFeed.coingeckoAddress;
      }
    }

    const updated = await container.model.tokenService().update({
      ...token,
      alias,
      name: typeof name === 'string' ? name : token.name,
      symbol: typeof symbol === 'string' ? symbol : token.symbol,
      decimals: typeof decimals === 'number' ? decimals : token.decimals,
      priceFeed: priceFeedInput,
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

export const TokenAliasStakedStatisticsType = new GraphQLObjectType<
  TokenAlias & { protocol: string }
>({
  name: 'TokenAliasStakedStatistics',
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
              .innerJoin(
                `${contractTableName} AS ct`,
                `${metricWalletTokenTableName}.contract`,
                'ct.id',
              )
              .innerJoin(`${contractBlockchainTableName} AS ctb`, `ctb.id`, 'ct.id')
              .innerJoin(`${protocolTableName} AS pt`, 'ct.protocol', 'pt.id')
              .whereRaw(
                `(${metricWalletTokenTableName}.data->>'usd' IS NOT NULL OR ${metricWalletTokenTableName}.data->>'balance' IS NOT NULL)`,
              )
              .andWhere('t.alias', tokenAlias.id)
              .andWhere('wlt.user', currentUser.id)
              .andWhere('pt.id', tokenAlias.protocol)
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
      type: GraphQLNonNull(PaginateList('TokenListInteractedType', GraphQLNonNull(TokenType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'TokenListInteractedFilterInputType',
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
          'TokenListInteractedSortInputType',
          ['id', 'name', 'symbol', 'address', 'createdAt'],
          [{ column: 'name', order: 'asc' }],
        ),
        pagination: PaginationArgument('TokenListInteractedPaginationInputType'),
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
          hasLogo: {
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
      if (filter.hasLogo !== undefined && filter.hasLogo === true) {
        this.andWhereNot('logoUrl', null);
      }
      if (filter.search !== undefined && filter.search !== '') {
        this.where(function () {
          this.where('id', 'iLike', `%${filter.search}%`)
            .orWhere('name', 'iLike', `%${filter.search}%`)
            .orWhere('symbol', 'iLike', `%${filter.search}%`);
        });
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
