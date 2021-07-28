import container from '@container';
import { Request } from 'express';
import {
  Product,
  ProductCode,
  productTableName,
  Purchase,
  purchaseTableName,
} from '@models/Store/Entity';
import { User } from '@models/User/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
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
} from 'graphql';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import {
  BlockchainEnum,
  DateTimeType,
  onlyAllowed,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';

export const PurchaseType = new GraphQLObjectType<Purchase>({
  name: 'StorePurchaseType',
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
    account: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Account',
    },
    amount: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Amount product',
    },
    tx: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Transaction id',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const ProductCodeEnum = new GraphQLEnumType({
  name: 'StoreProductCodeEnum',
  values: {
    [ProductCode.Notification]: {
      description: 'Notification',
    },
  },
});

export const ProductType = new GraphQLObjectType<Product>({
  name: 'StoreProductType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    number: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Number of blockchain',
    },
    code: {
      type: GraphQLNonNull(ProductCodeEnum),
      description: 'System code',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Description',
    },
    priceUSD: {
      type: GraphQLNonNull(GraphQLFloat),
      description: 'Price in USD',
    },
    amount: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Amount product',
    },
    purchases: {
      type: GraphQLNonNull(PaginateList('StorePurchaseListType', GraphQLNonNull(PurchaseType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'StorePurchaseListFilterInputType',
            fields: {
              user: {
                type: UuidType,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'StorePurchaseListSortInputType',
          ['id', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('StorePurchaseListPaginationInputType'),
      },
      resolve: async (product, { filter, sort, pagination }) => {
        const select = container.model
          .storePurchaseTable()
          .innerJoin(walletTableName, function () {
            this.on(`${walletTableName}.blockchain`, '=', `${purchaseTableName}.blockchain`)
              .andOn(`${walletTableName}.network`, '=', `${purchaseTableName}.network`)
              .andOn(`${walletTableName}.address`, '=', `${purchaseTableName}.account`);
          })
          .where(function () {
            this.where('product', product.id);
            if (filter.user !== undefined) {
              this.andWhere(`${walletTableName}.user`, filter.user);
            }
          });

        return {
          list: await select
            .clone()
            .columns(`${purchaseTableName}.*`)
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().count(`${purchaseTableName}.id`).first(),
          },
        };
      },
    },
    updatedAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of updated',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const UserStoreBalanceType = new GraphQLObjectType<User>({
  name: 'UserStoreBalanceType',
  fields: {
    notifications: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Available nofications count',
      resolve: (user) => {
        return container.model.storeService().availableNotifications(user);
      },
    },
  },
});

export const UserStoreType = new GraphQLObjectType<User>({
  name: 'UserStoreType',
  fields: {
    purchases: {
      type: GraphQLNonNull(PaginateList('UserStorePurchaseListType', GraphQLNonNull(PurchaseType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserStorePurchaseListFilterInputType',
            fields: {
              product: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserStorePurchaseListSortInputType',
          ['id', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserStorePurchaseListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model
          .storePurchaseTable()
          .innerJoin(walletTableName, function () {
            this.on(`${walletTableName}.blockchain`, '=', `${purchaseTableName}.blockchain`)
              .andOn(`${walletTableName}.network`, '=', `${purchaseTableName}.network`)
              .andOn(`${walletTableName}.address`, '=', `${purchaseTableName}.account`);
          })
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            if (filter.product !== undefined) {
              this.whereIn(`${purchaseTableName}.product`, filter.product);
            }
          });

        return {
          list: await select
            .clone()
            .distinct(`${purchaseTableName}.*`)
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().countDistinct(`${purchaseTableName}.id`).first(),
          },
        };
      },
    },
    products: {
      type: GraphQLNonNull(PaginateList('UserStoreProductListType', GraphQLNonNull(ProductType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserStoreProductListFilterInputType',
            fields: {
              code: {
                type: GraphQLList(GraphQLNonNull(ProductCodeEnum)),
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserStoreProductListSortInputType',
          ['id', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserStoreProductListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model
          .storeProductTable()
          .innerJoin(
            purchaseTableName,
            `${productTableName}.id`,
            '=',
            `${purchaseTableName}.product`,
          )
          .innerJoin(walletTableName, function () {
            this.on(`${walletTableName}.blockchain`, '=', `${purchaseTableName}.blockchain`)
              .andOn(`${walletTableName}.network`, '=', `${purchaseTableName}.network`)
              .andOn(`${walletTableName}.address`, '=', `${purchaseTableName}.account`);
          })
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            if (Array.isArray(filter.code) && filter.code.length > 0) {
              this.whereIn(`${productTableName}.code`, filter.code);
            }
          });

        return {
          list: await select
            .clone()
            .distinct(`${productTableName}.*`)
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().countDistinct(`${productTableName}.id`).first(),
          },
        };
      },
    },
    balance: {
      type: GraphQLNonNull(UserStoreBalanceType),
      resolve: (user) => user,
    },
  },
});

export const ProductListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('StoreProductListQuery', GraphQLNonNull(ProductType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'StoreProductListQueryFilterInputType',
        fields: {
          code: {
            type: GraphQLList(GraphQLNonNull(ProductCodeEnum)),
          },
          search: {
            type: GraphQLString,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'StoreProductListQuerySortInputType',
      ['id', 'name', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('StoreProductListQueryPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const select = container.model.storeProductTable().where(function () {
      if (Array.isArray(filter.code) && filter.code.length > 0) {
        this.whereIn('code', filter.code);
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

export const ProductCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProductType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'StoreProductCreateInputType',
          fields: {
            number: {
              type: GraphQLNonNull(GraphQLInt),
              description: 'Number of blockchain',
            },
            code: {
              type: GraphQLNonNull(ProductCodeEnum),
              description: 'System code',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
            description: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Description',
            },
            priceUSD: {
              type: GraphQLNonNull(GraphQLFloat),
              description: 'Price in USD',
            },
            amount: {
              type: GraphQLNonNull(GraphQLInt),
              description: 'Amount of product',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('product.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { number, code, name, description, priceUSD, amount } = input;
    const created = await container.model
      .storeService()
      .create(number, code, name, description, priceUSD, amount);

    return created;
  }),
};

export const ProductUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProductType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'StoreProductUpdateInputType',
          fields: {
            number: {
              type: GraphQLNonNull(GraphQLInt),
              description: 'Number of blockchain',
            },
            code: {
              type: GraphQLNonNull(ProductCodeEnum),
              description: 'System code',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
            description: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Description',
            },
            priceUSD: {
              type: GraphQLNonNull(GraphQLFloat),
              description: 'Price in USD',
            },
            amount: {
              type: GraphQLNonNull(GraphQLInt),
              description: 'Amount of product',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('product.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const storeService = container.model.storeService();
    const product = await storeService.productTable().where('id', id).first();
    if (!product) throw new UserInputError('Product not found');

    const { number, code, name, description, priceUSD, amount } = input;
    const updated = await storeService.update({
      ...product,
      number: typeof number === 'number' ? number : product.number,
      code: [ProductCode.Notification].includes(code) ? code : product.code,
      name: typeof name === 'string' ? name : product.name,
      description: typeof description === 'string' ? description : product.description,
      priceUSD: typeof priceUSD === 'number' ? priceUSD : product.priceUSD,
      amount: typeof amount === 'number' ? amount : product.amount,
    });

    return updated;
  }),
};

export const ProductDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('product.delete', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const storeService = container.model.storeService();
    const product = await storeService.productTable().where('id', id).first();
    if (!product) throw new UserInputError('Product not found');

    await storeService.delete(product);

    return true;
  }),
};
