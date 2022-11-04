import container from '@container';
import { Request } from 'express';
import { AuthenticationError, UserInputError } from 'apollo-server-express';
import { User } from '@models/User/Entity';
import {
  Wallet,
  WalletBlockchain,
  walletBlockchainTableName,
  walletTableName,
} from '@models/Wallet/Entity';
import { withFilter } from 'graphql-subscriptions';
import {
  Bill,
  BillStatus,
  Transfer,
  transferTableName,
  billTableName,
  TransferStatus,
} from '@models/Billing/Entity';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFieldConfig,
} from 'graphql';
import BN from 'bignumber.js';
import { OrderStatus } from '@models/SmartTrade/Entity';
import {
  BigNumberType,
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';

export const BillStatusEnum = new GraphQLEnumType({
  name: 'BillingBillStatusEnum',
  values: {
    [BillStatus.Pending]: {
      description: 'Bill awaiting confirmation',
    },
    [BillStatus.Accepted]: {
      description: 'Bill accepted',
    },
    [BillStatus.Rejected]: {
      description: 'Bill rejected',
    },
  },
});

export const BillType = new GraphQLObjectType<Bill>({
  name: 'BillingBillType',
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
    claimant: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Claimant',
    },
    claimGasFee: {
      type: GraphQLNonNull(BigNumberType),
      description: 'Declarate gas fee',
    },
    claimProtocolFee: {
      type: GraphQLNonNull(BigNumberType),
      description: 'Declarate protocol fee',
    },
    gasFee: {
      type: BigNumberType,
      description: 'Confirmed gas fee',
    },
    protocolFee: {
      type: BigNumberType,
      description: 'Confirmed protocol fee',
    },
    claim: {
      type: GraphQLNonNull(BigNumberType),
      description: 'Balance of claim after make the bill',
    },
    status: {
      type: GraphQLNonNull(BillStatusEnum),
      description: 'Current status',
    },
    tx: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Transaction id',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
    updatedAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of last updated',
    },
  },
});

export const TransferStatusEnum = new GraphQLEnumType({
  name: 'BillingTransferStatusEnum',
  values: Object.values(TransferStatus).reduce(
    (res, type) => ({ ...res, [type]: { value: type } }),
    {},
  ),
});

export const TransferType = new GraphQLObjectType<Transfer>({
  name: 'BillingTransferType',
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
      type: GraphQLNonNull(BigNumberType),
      description: 'Transfer amount (must be negative)',
    },
    tx: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Transaction id',
    },
    bill: {
      type: BillType,
      description: 'Bill',
      resolve: ({ bill }) => {
        return bill ? container.model.billingBillTable().where('id', bill).first() : null;
      },
    },
    status: {
      type: GraphQLNonNull(TransferStatusEnum),
    },
    rejectReason: {
      type: GraphQLNonNull(GraphQLString),
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const WalletBalanceType = new GraphQLObjectType({
  name: 'BillingWalletBalanceType',
  fields: {
    lowFeeFunds: {
      type: GraphQLNonNull(GraphQLBoolean),
    },
    balance: {
      type: GraphQLNonNull(BigNumberType),
    },
    claim: {
      type: GraphQLNonNull(BigNumberType),
    },
    netBalance: {
      type: GraphQLNonNull(BigNumberType),
    },
    netBalanceUSD: {
      type: GraphQLNonNull(BigNumberType),
    },
  },
});

export const WalletBillingType = new GraphQLObjectType<Wallet & WalletBlockchain>({
  name: 'WalletBillingType',
  fields: {
    transfers: {
      type: GraphQLNonNull(
        PaginateList('WalletBillingTransferListType', GraphQLNonNull(TransferType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletBillingTransferListFilterInputType',
            fields: {
              deposit: {
                type: GraphQLBoolean,
              },
              claim: {
                type: GraphQLBoolean,
              },
              status: {
                type: GraphQLList(GraphQLNonNull(TransferStatusEnum)),
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletBillingTransferListSortInputType',
          ['id', 'amount', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletBillingTransferListPaginationInputType'),
      },
      resolve: async (wallet, { filter, sort, pagination }) => {
        const select = container.model.billingTransferTable().where(function () {
          this.where({
            blockchain: wallet.blockchain,
            network: wallet.network,
            account: wallet.address,
          });
          if (filter.deposit !== undefined) {
            this.andWhere('amount', filter.deposit ? '>=' : '<', 0);
          }
          if (filter.claim !== undefined) {
            if (filter.claim) {
              this.whereNotNull('bill');
            } else {
              this.whereNull('bill');
            }
          }
          if (Array.isArray(filter.status) && filter.status.length > 0) {
            this.whereIn('status', filter.status);
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
    bills: {
      type: GraphQLNonNull(PaginateList('WalletBillingBillListType', GraphQLNonNull(BillType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'WalletBillingBillListFilterInputType',
            fields: {
              status: {
                type: BillStatusEnum,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'WalletBillingBillListSortInputType',
          ['id', 'updatedAt', 'createdAt'],
          [{ column: 'updatedAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('WalletBillingBillListPaginationInputType'),
      },
      resolve: async (wallet, { filter, sort, pagination }) => {
        const select = container.model.billingBillTable().where(function () {
          this.where({
            blockchain: wallet.blockchain,
            network: wallet.network,
            account: wallet.address,
          });
          if (filter.status !== undefined) {
            this.andWhere('status', filter.status);
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
    balance: {
      type: GraphQLNonNull(WalletBalanceType),
      resolve: async (wallet) => {
        const [
          transferSum,
          unconfirmedTransferSum,
          billSum,
          activeAutomates,
          activeSmartTradeOrders,
        ] = await Promise.all([
          container.model
            .billingTransferTable()
            .sum('amount')
            .where({
              blockchain: wallet.blockchain,
              network: wallet.network,
              account: wallet.address,
            })
            .where('status', TransferStatus.Confirmed)
            .first(),
          container.model
            .billingTransferTable()
            .sum('amount')
            .where({
              blockchain: wallet.blockchain,
              network: wallet.network,
              account: wallet.address,
            })
            .whereIn('status', [TransferStatus.Pending, TransferStatus.Confirmed])
            .first(),
          container.model
            .billingBillTable()
            .sum('claim')
            .where({
              blockchain: wallet.blockchain,
              network: wallet.network,
              account: wallet.address,
            })
            .whereIn('status', [BillStatus.Pending, BillStatus.Accepted])
            .first(),
          container.model
            .automateTriggerTable()
            .where({
              wallet: wallet.id,
              active: true,
            })
            .count()
            .first(),
          container.model
            .smartTradeOrderTable()
            .where('owner', wallet.id)
            .where('status', OrderStatus.Pending)
            .where('confirmed', true)
            .count()
            .first(),
        ]);
        const balance = new BN(transferSum?.sum || 0);
        const unconfirmedBalance = new BN(unconfirmedTransferSum?.sum || 0);
        const claim = new BN(billSum?.sum || 0);
        const activeAutomatesCount = activeAutomates?.count || 0;
        const activeSmartTradeOrdersCount = activeSmartTradeOrders?.count || 0;

        if (
          wallet.blockchain !== 'ethereum' ||
          (activeAutomatesCount < 1 && activeSmartTradeOrdersCount < 1)
        ) {
          return {
            balance,
            claim,
            netBalance: balance.minus(claim),
            netBalanceUSD: 0,
            lowFeeFunds: false,
          };
        }

        const chainNativeUSD = await container.blockchain.ethereum
          .byNetwork(wallet.network)
          .nativeTokenPrice()
          .then((v) => Number(v));

        return {
          balance,
          claim,
          netBalance: balance.minus(claim),
          netBalanceUSD: balance.minus(claim).multipliedBy(chainNativeUSD),
          lowFeeFunds: unconfirmedBalance.multipliedBy(chainNativeUSD).lte(18),
        };
      },
    },
  },
});

export const UserBalanceType = new GraphQLObjectType({
  name: 'BillingUserBalanceType',
  fields: {
    pending: {
      type: GraphQLNonNull(BigNumberType),
    },
    balance: {
      type: GraphQLNonNull(BigNumberType),
    },
    claim: {
      type: GraphQLNonNull(BigNumberType),
    },
    netBalance: {
      type: GraphQLNonNull(BigNumberType),
    },
  },
});

export const UserBillingType = new GraphQLObjectType<User>({
  name: 'UserBillingType',
  fields: {
    transfers: {
      type: GraphQLNonNull(
        PaginateList('UserBillingTransferListType', GraphQLNonNull(TransferType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserBillingTransferListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainFilterInputType,
              },
              deposit: {
                type: GraphQLBoolean,
              },
              claim: {
                type: GraphQLBoolean,
              },
              wallet: {
                type: GraphQLList(GraphQLNonNull(UuidType)),
              },
              status: {
                type: GraphQLList(GraphQLNonNull(TransferStatusEnum)),
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserBillingTransferListSortInputType',
          ['id', 'amount', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserBillingTransferListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model
          .billingTransferTable()
          .innerJoin(walletBlockchainTableName, function () {
            this.on(
              `${walletBlockchainTableName}.blockchain`,
              '=',
              `${transferTableName}.blockchain`,
            )
              .andOn(`${walletBlockchainTableName}.network`, '=', `${transferTableName}.network`)
              .andOn(`${walletBlockchainTableName}.address`, '=', `${transferTableName}.account`);
          })
          .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere(`${walletBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${walletBlockchainTableName}.network`, network);
              }
            }
            if (filter.deposit !== undefined) {
              this.andWhere(`${transferTableName}.amount`, filter.deposit ? '>=' : '<', 0);
            }
            if (filter.claim !== undefined) {
              if (filter.claim) {
                this.whereNotNull(`${transferTableName}.bill`);
              } else {
                this.whereNull(`${transferTableName}.bill`);
              }
            }
            if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
              this.whereIn(`${walletTableName}.id`, filter.wallet);
            }
            if (Array.isArray(filter.status) && filter.status.length > 0) {
              this.whereIn(`${transferTableName}.status`, filter.status);
            }
          });

        return {
          list: await select
            .clone()
            .distinct(`${transferTableName}.*`)
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().countDistinct(`${transferTableName}.id`).first(),
          },
        };
      },
    },
    bills: {
      type: GraphQLNonNull(PaginateList('UserBillingBillListType', GraphQLNonNull(BillType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'UserBillingBillListFilterInputType',
            fields: {
              blockchain: {
                type: BlockchainFilterInputType,
              },
              status: {
                type: BillStatusEnum,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'UserBillingBillListSortInputType',
          ['id', 'updatedAt', 'createdAt'],
          [{ column: 'updatedAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('UserBillingBillListPaginationInputType'),
      },
      resolve: async (user, { filter, sort, pagination }) => {
        const select = container.model
          .billingBillTable()
          .innerJoin(walletBlockchainTableName, function () {
            this.on(`${walletBlockchainTableName}.blockchain`, '=', `${billTableName}.blockchain`);
            this.on(`${walletBlockchainTableName}.network`, '=', `${billTableName}.network`);
            this.on(`${walletBlockchainTableName}.address`, '=', `${billTableName}.account`);
          })
          .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
          .where(function () {
            this.where(`${walletTableName}.user`, user.id);
            if (filter.blockchain) {
              const { protocol, network } = filter.blockchain;
              this.andWhere(`${walletBlockchainTableName}.blockchain`, protocol);
              if (network !== undefined) {
                this.andWhere(`${walletBlockchainTableName}.network`, network);
              }
            }
            if (filter.status !== undefined) {
              this.andWhere(`${billTableName}.status`, filter.status);
            }
          });

        return {
          list: await select
            .clone()
            .distinct(`${billTableName}.*`)
            .orderBy(sort)
            .limit(pagination.limit)
            .offset(pagination.offset),
          pagination: {
            count: await select.clone().countDistinct(`${billTableName}.id`).first(),
          },
        };
      },
    },
    balance: {
      type: GraphQLNonNull(UserBalanceType),
      resolve: async (user) => {
        const [transferUnconfirmedSum, transferConfirmedSum, billSum] = await Promise.all([
          container.model
            .billingTransferTable()
            .sum({ sum: `${transferTableName}.amount` })
            .innerJoin(walletBlockchainTableName, function () {
              this.on(
                `${walletBlockchainTableName}.blockchain`,
                '=',
                `${transferTableName}.blockchain`,
              );
              this.on(`${walletBlockchainTableName}.network`, '=', `${transferTableName}.network`);
              this.on(`${walletBlockchainTableName}.address`, '=', `${transferTableName}.account`);
            })
            .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
            .where(`${walletTableName}.user`, user.id)
            .where(`${transferTableName}.status`, TransferStatus.Pending)
            .first(),
          container.model
            .billingTransferTable()
            .sum({ sum: `${transferTableName}.amount` })
            .innerJoin(walletBlockchainTableName, function () {
              this.on(
                `${walletBlockchainTableName}.blockchain`,
                '=',
                `${transferTableName}.blockchain`,
              );
              this.on(`${walletBlockchainTableName}.network`, '=', `${transferTableName}.network`);
              this.on(`${walletBlockchainTableName}.address`, '=', `${transferTableName}.account`);
            })
            .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
            .where(`${walletTableName}.user`, user.id)
            .where(`${transferTableName}.status`, TransferStatus.Confirmed)
            .first(),
          container.model
            .billingBillTable()
            .sum({ sum: 'claim' })
            .innerJoin(walletBlockchainTableName, function () {
              this.on(
                `${walletBlockchainTableName}.blockchain`,
                '=',
                `${billTableName}.blockchain`,
              );
              this.on(`${walletBlockchainTableName}.network`, '=', `${billTableName}.network`);
              this.on(`${walletBlockchainTableName}.address`, '=', `${billTableName}.account`);
            })
            .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
            .where(`${walletTableName}.user`, user.id)
            .first(),
        ]);
        const pending = new BN(transferUnconfirmedSum?.sum || 0);
        const balance = new BN(transferConfirmedSum?.sum || 0);
        const claim = new BN(billSum?.sum || 0);

        return {
          pending,
          balance,
          claim,
          netBalance: balance.minus(claim),
        };
      },
    },
  },
});

export const BalanceMetaType = new GraphQLObjectType({
  name: 'BalanceMetaType',
  fields: {
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    recomendedIncome: {
      type: GraphQLNonNull(GraphQLString),
    },
    priceUSD: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const BalanceMetaQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(BalanceMetaType),
  args: {
    blockchain: {
      type: GraphQLNonNull(BlockchainEnum),
    },
    network: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Chain ID',
    },
  },
  resolve: async (root, { blockchain, network }) => {
    if (blockchain === 'ethereum') {
      const provider = container.blockchain.ethereum.byNetwork(network);
      return {
        token: provider.nativeTokenDetails.symbol,
        recomendedIncome: new BN(20).dividedBy(await provider.nativeTokenPrice()).toString(10),
        priceUSD: await provider.nativeTokenPrice(),
      };
    }
    if (blockchain === 'waves') {
      return {
        token: 'WAVES',
        recomendedIncome: '1',
        priceUSD: '0', // todo: price feed call
      };
    }
    throw new UserInputError('Invalid blockchain');
  },
};

export const AddTransferMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(TransferType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'BillingTransferCreateInputType',
          fields: {
            blockchain: {
              type: GraphQLNonNull(BlockchainEnum),
            },
            network: {
              type: GraphQLNonNull(GraphQLString),
            },
            account: {
              type: GraphQLNonNull(GraphQLString),
            },
            amount: {
              type: GraphQLNonNull(BigNumberType),
            },
            tx: {
              type: GraphQLNonNull(GraphQLString),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { blockchain, network, account, amount, tx } = input;
    const duplicate = await container.model
      .billingTransferTable()
      .where({
        blockchain,
        network,
        account: blockchain === 'ethereum' ? account.toLowerCase() : account,
        tx,
      })
      .first();
    if (duplicate) return duplicate;

    return container.model
      .billingService()
      .transfer(
        blockchain,
        network,
        blockchain === 'ethereum' ? account.toLowerCase() : account,
        amount,
        tx,
        false,
        new Date(),
        null,
      );
  },
};

export const OnTransferCreated: GraphQLFieldConfig<{ id: string }, Request> = {
  type: GraphQLNonNull(TransferType),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnTransferCreatedFilterInputType',
        fields: {
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
    () => container.cacheSubscriber('defihelper:channel:onBillingTransferCreated').asyncIterator(),
    async ({ id }, { filter }) => {
      const transfer = await container.model.billingTransferTable().where('id', id).first();
      if (!transfer) return false;
      const wallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where({
          blockchain: transfer.blockchain,
          network: transfer.network,
          address:
            transfer.blockchain === 'ethereum' ? transfer.account.toLowerCase() : transfer.account,
        })
        .first();
      if (!wallet) return false;

      let result = true;
      if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
        result = result && filter.wallet.includes(wallet.id);
      }
      if (Array.isArray(filter.user) && filter.user.length > 0) {
        result = result && filter.user.includes(wallet.user);
      }

      return result;
    },
  ),
  resolve: ({ id }) => {
    return container.model.billingTransferTable().where('id', id).first();
  },
};

export const OnTransferUpdated: GraphQLFieldConfig<{ id: string }, Request> = {
  type: GraphQLNonNull(TransferType),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'OnTransferUpdatedFilterInputType',
        fields: {
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
    () => container.cacheSubscriber('defihelper:channel:onBillingTransferUpdated').asyncIterator(),
    async ({ id }, { filter }) => {
      const transfer = await container.model.billingTransferTable().where('id', id).first();
      if (!transfer) return false;
      const wallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where({
          blockchain: transfer.blockchain,
          network: transfer.network,
          address:
            transfer.blockchain === 'ethereum' ? transfer.account.toLowerCase() : transfer.account,
        })
        .first();
      if (!wallet) return false;

      let result = true;
      if (Array.isArray(filter.wallet) && filter.wallet.length > 0) {
        result = result && filter.wallet.includes(wallet.id);
      }
      if (Array.isArray(filter.user) && filter.user.length > 0) {
        result = result && filter.user.includes(wallet.user);
      }

      return result;
    },
  ),
  resolve: ({ id }) => {
    return container.model.billingTransferTable().where('id', id).first();
  },
};

export const ZAPFeePayCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ZAPFeePayCreateInputType',
          fields: {
            type: {
              type: GraphQLNonNull(
                new GraphQLEnumType({
                  name: 'ZAPFeePayCreateTypeEnum',
                  values: {
                    Buy: { value: 'buy' },
                    Sell: { value: 'sell' },
                  },
                }),
              ),
            },
            wallet: {
              type: GraphQLNonNull(UuidType),
            },
            fee: {
              type: GraphQLNonNull(BigNumberType),
            },
            feeUSD: {
              type: GraphQLNonNull(BigNumberType),
            },
            tx: {
              type: GraphQLNonNull(GraphQLString),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { type, wallet, fee, feeUSD, tx } = input;
    const walletBlockchain = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletTableName}.id`,
        `${walletBlockchainTableName}.id`,
      )
      .where(`${walletTableName}.id`, wallet)
      .first();
    if (!walletBlockchain) {
      throw new UserInputError('Wallet not found');
    }

    await container.amplitude().log('ZAP', currentUser.id, {
      type,
      wallet,
      fee: fee.toString(10),
      feeUSD: feeUSD.toString(10),
      tx,
    });

    return true;
  },
};
