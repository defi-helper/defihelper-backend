import { AuthenticationError, UserInputError } from 'apollo-server-express';
import container from '@container';
import { Request } from 'express';
import BN from 'bignumber.js';
import { PriceFeed, Token, TokenAlias, TokenAliasLiquidity } from '@models/Token/Entity';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  MetricChangeType,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  RiskScoringEnum,
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
    uniswapRouterV2: {
      type: new GraphQLInputObjectType({
        name: 'TokenPriceFeedUniswapRouterV2InputType',
        fields: {
          route: { type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))) },
          routerAddress: { type: GraphQLNonNull(GraphQLString) },
          outputDecimals: { type: GraphQLNonNull(GraphQLInt) },
        },
      }),
    },
  },
});

export const TokenMetricRiskType = new GraphQLObjectType({
  name: 'TokenMetricRiskType',
  fields: {
    totalRate: {
      type: GraphQLNonNull(RiskScoringEnum),
    },
    reliabilityRate: {
      type: GraphQLNonNull(RiskScoringEnum),
    },
    profitabilityRate: {
      type: GraphQLNonNull(RiskScoringEnum),
    },
    volatilityRate: {
      type: GraphQLNonNull(RiskScoringEnum),
    },
    total: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    reliability: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    profitability: {
      type: GraphQLNonNull(GraphQLFloat),
    },
    volatility: {
      type: GraphQLNonNull(GraphQLFloat),
    },
  },
});

export const TokenMetricType = new GraphQLObjectType({
  name: 'TokenMetricType',
  fields: {
    risk: {
      type: GraphQLNonNull(TokenMetricRiskType),
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
    metric: {
      type: GraphQLNonNull(TokenMetricType),
      resolve: async (token, _, { dataLoader }) => dataLoader.tokenLastMetric().load(token.id),
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
        this.andWhere(function () {
          this.where('name', 'iLike', `%${filter.search}%`);
          this.orWhere('id', 'iLike', `%${filter.search}%`);
          this.orWhere('alias', 'iLike', `%${filter.search}%`);
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
      } else if (priceFeed.uniswapRouterV2) {
        priceFeed.uniswapRouterV2.type = 'uniswapRouterV2';
        if (!PriceFeed.isUniswapRouterV2(priceFeed.uniswapRouterV2)) {
          throw new UserInputError(
            `Invalid price feed "${JSON.stringify(priceFeed.uniswapRouterV2)}"`,
          );
        }

        priceFeedInput = priceFeed.uniswapRouterV2;
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
    myUSDChange: {
      type: GraphQLNonNull(MetricChangeType),
    },
    myPortfolioPercent: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const TokenAliasStakedStatisticsType = new GraphQLObjectType<
  TokenAlias & { protocol: string },
  Request
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
      resolve: async (tokenAlias, args, { currentUser, dataLoader }) => {
        if (!currentUser) {
          return {
            myBalance: '0',
            myUSD: '0',
            myPortfolioPercent: '0',
          };
        }
        const tokenMetric = await dataLoader
          .tokenAliasUserLastMetric({ user: currentUser.id, protocol: tokenAlias.protocol })
          .load(tokenAlias.id);

        return {
          myBalance: tokenMetric.balance,
          myUSD: tokenMetric.usd,
          myUSDChange: {
            day:
              Number(tokenMetric.usdDayBefore) !== 0
                ? new BN(tokenMetric.usd).div(tokenMetric.usdDayBefore).toString(10)
                : '0',
          },
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

export const TokenAliasType = new GraphQLObjectType<TokenAlias, Request>({
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
      resolve: async (tokenAlias, args, { currentUser, dataLoader }) => {
        if (!currentUser) {
          return {
            myBalance: '0',
            myUSD: '0',
            myUSDChange: {
              day: '0',
              week: '0',
              month: '0',
            },
            myPortfolioPercent: '0',
          };
        }
        const tokenMetric = await dataLoader
          .tokenAliasUserLastMetric({ user: currentUser.id })
          .load(tokenAlias.id);

        return {
          myBalance: tokenMetric.balance,
          myUSD: tokenMetric.usd,
          myUSDChange: {
            day:
              Number(tokenMetric.usdDayBefore) !== 0
                ? new BN(tokenMetric.usd).div(tokenMetric.usdDayBefore).toString(10)
                : '0',
          },
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
            type: GraphQLList(GraphQLNonNull(GraphQLString)),
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
      if (Array.isArray(filter.symbol) && filter.symbol.length > 0) {
        this.whereIn('symbol', filter.symbol);
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
