import container from '@container';
import dayjs from 'dayjs';
import { Request } from 'express';
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
  Contract,
  ProtocolLink,
  ProtocolLinkMap,
  contractTableName,
  Protocol,
  walletContractLinkTableName,
  ContractAutomate,
} from '@models/Protocol/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import {
  metricContractTableName,
  metricProtocolTableName,
  metricWalletTableName,
} from '@models/Metric/Entity';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import BN from 'bignumber.js';
import { Blockchain } from '@models/types';
import { Post } from '@models/Protocol/Social/Entity';
import { PostProvider } from '@services/SocialStats';
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
  onlyAllowed,
  UuidType,
  WalletBlockchainTypeEnum,
} from '../types';

export const ContractMetricType = new GraphQLObjectType({
  name: 'ContractMetricType',
  fields: {
    tvl: {
      type: GraphQLNonNull(GraphQLString),
    },
    aprDay: {
      type: GraphQLNonNull(GraphQLString),
    },
    aprWeek: {
      type: GraphQLNonNull(GraphQLString),
    },
    aprMonth: {
      type: GraphQLNonNull(GraphQLString),
    },
    aprYear: {
      type: GraphQLNonNull(GraphQLString),
    },
    myStaked: {
      type: GraphQLNonNull(GraphQLString),
    },
    myEarned: {
      type: GraphQLNonNull(GraphQLString),
    },
    myAPYBoost: {
      type: GraphQLNonNull(GraphQLString),
    },
  },
});

export const ContractAutomatesType = new GraphQLObjectType<ContractAutomate, Request>({
  name: 'ContractAutomatesType',
  fields: {
    adapters: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
      description: 'Usable automate adapters',
    },
    autorestake: {
      type: GraphQLString,
      description: 'Autorestake adapter name',
      resolve: ({ autorestakeAdapter }) => autorestakeAdapter,
    },
    buyLiquidity: {
      type: new GraphQLObjectType({
        name: 'ContractAutomatesBuyLiquidityType',
        fields: {
          router: {
            type: GraphQLNonNull(GraphQLString),
            description: 'Liquidity pool router address',
          },
          pair: {
            type: GraphQLNonNull(GraphQLString),
            description: 'Target pool address',
          },
        },
      }),
      description: 'Buy liquidity automate config',
    },
  },
});

export const ContractType = new GraphQLObjectType<Contract, Request>({
  name: 'ContractType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    protocolId: {
      type: GraphQLNonNull(UuidType),
      resolve: ({ protocol }) => protocol,
    },
    adapter: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Adapter name',
    },
    layout: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Layout name',
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
    deployBlockNumber: {
      type: GraphQLString,
      description: 'Contract deployment block number',
    },
    automate: {
      type: GraphQLNonNull(ContractAutomatesType),
      description: 'Usable automates',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Description',
    },
    link: {
      type: GraphQLString,
      description: 'View URL',
    },
    hidden: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is hidden',
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
            name: 'ContractMetricChartFilterInputType',
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
          'ContractMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('ContractMetricChartPaginationInputType'),
      },
      resolve: async (contract, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        const select = container.model
          .metricContractTable()
          .distinctOn('date')
          .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricContractTableName}.date) AS "date"`))
          .where(function () {
            this.where(`${metricContractTableName}.contract`, contract.id).andWhere(
              database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.dateAfter) {
              this.andWhere(`${metricContractTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricContractTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy('date')
          .orderBy(`${metricContractTableName}.date`, 'DESC');

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
      type: GraphQLNonNull(ContractMetricType),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'ContractMetricFilterInputType',
            fields: {
              wallet: {
                type: new GraphQLInputObjectType({
                  name: 'ContractMetricWalletFilterInputType',
                  fields: {
                    type: {
                      type: GraphQLList(GraphQLNonNull(WalletBlockchainTypeEnum)),
                    },
                  },
                }),
              },
            },
          }),
          defaultValue: {},
        },
      },
      resolve: async (contract, { filter }, { currentUser, dataLoader }) => {
        const metric = {
          tvl: contract.metric.tvl ?? '0',
          aprDay: contract.metric.aprDay ?? '0',
          aprWeek: contract.metric.aprWeek ?? '0',
          aprMonth: contract.metric.aprMonth ?? '0',
          aprYear: contract.metric.aprYear ?? '0',
          myStaked: '0',
          myEarned: '0',
          myAPYBoost: '0',
        };
        if (!currentUser) {
          metric.myAPYBoost = await apyBoost(
            contract.blockchain,
            contract.network,
            10000,
            new BN(contract.metric.aprYear ?? '0').toNumber(),
          );
          return metric;
        }

        const userMetric = await dataLoader
          .contractUserMetric({
            userId: currentUser.id,
            walletType: filter.wallet?.type ?? [
              WalletBlockchainType.Contract,
              WalletBlockchainType.Wallet,
            ],
          })
          .load(contract.id);
        const totalBalance = new BN(userMetric.stakingUSD).plus(userMetric.earnedUSD).toNumber();
        return {
          ...metric,
          myStaked: userMetric.stakingUSD,
          myEarned: userMetric.earnedUSD,
          myAPYBoost: await apyBoost(
            contract.blockchain,
            contract.network,
            totalBalance > 0 ? totalBalance : 10000,
            new BN(contract.metric.aprYear ?? '0').toNumber(),
          ),
        };
      },
    },
    events: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
      resolve: async (contract) => {
        if (contract.blockchain !== 'ethereum') return [];

        const contractFromScanner = await container
          .scanner()
          .findContract(contract.network, contract.address);
        if (!contractFromScanner || !contractFromScanner.abi) {
          return [];
        }

        return contractFromScanner.abi
          .filter(({ type }: any) => type === 'event')
          .map(({ name }: any) => name);
      },
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created account',
    },
  },
});

export const ContractCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ContractType),
  args: {
    protocol: {
      type: GraphQLNonNull(UuidType),
      description: 'Parent protocol',
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ContractCreateInputType',
          fields: {
            blockchain: {
              type: GraphQLNonNull(BlockchainEnum),
              description: 'Blockchain protocol',
            },
            network: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Blockchain network',
            },
            address: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Address',
            },
            adapter: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Adapter name',
            },
            deployBlockNumber: {
              type: GraphQLString,
              description: 'Contract deployment block number',
              defaultValue: null,
            },
            layout: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Layout name',
            },
            automates: {
              type: GraphQLList(GraphQLNonNull(GraphQLString)),
              description: 'Usable automates',
              defaultValue: [],
            },
            autorestakeAdapter: {
              type: GraphQLString,
              description: 'Usable autorestake contract adapter',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
            description: {
              type: GraphQLString,
              description: 'Description',
              defaultValue: '',
            },
            link: {
              type: GraphQLString,
              description: 'Website URL',
              defaultValue: null,
            },
            hidden: {
              type: GraphQLBoolean,
              description: 'Is hidden',
              defaultValue: false,
            },
            eventsToSubscribe: {
              type: GraphQLList(GraphQLNonNull(GraphQLString)),
              description: 'Events to subscribe in scanner',
              defaultValue: undefined,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed(
    'contract.create',
    async (root, { protocol: protocolId, input }, { currentUser }) => {
      if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

      const protocol = await container.model.protocolTable().where('id', protocolId).first();
      if (!protocol) throw new UserInputError('Protocol not found');

      const {
        blockchain,
        network,
        address,
        deployBlockNumber,
        adapter,
        automates,
        autorestakeAdapter,
        layout,
        name,
        description,
        link,
        hidden,
        eventsToSubscribe,
      } = input;
      const created = await container.model.contractService().create(
        protocol,
        blockchain,
        network,
        address,
        deployBlockNumber,
        adapter,
        layout,
        {
          adapters: automates ?? [],
          autorestakeAdapter,
        },
        name,
        description,
        link,
        hidden,
        eventsToSubscribe,
      );

      return created;
    },
  ),
};

export const ContractUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ContractType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ContractUpdateInputType',
          fields: {
            blockchain: {
              type: BlockchainEnum,
              description: 'Blockchain protocol',
            },
            network: {
              type: GraphQLString,
              description: 'Blockchain network',
            },
            address: {
              type: GraphQLString,
              description: 'Address',
            },
            deployBlockNumber: {
              type: GraphQLString,
              description: 'Contract deployment block number',
            },
            adapter: {
              type: GraphQLString,
              description: 'Adapter name',
            },
            layout: {
              type: GraphQLString,
              description: 'Layout name',
            },
            automates: {
              type: GraphQLList(GraphQLNonNull(GraphQLString)),
              description: 'Usable automates',
              defaultValue: [],
            },
            autorestakeAdapter: {
              type: GraphQLString,
              description: 'Usable autorestake contract adapter',
            },
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            description: {
              type: GraphQLString,
              description: 'Description',
              defaultValue: '',
            },
            link: {
              type: GraphQLString,
              description: 'Website URL',
              defaultValue: null,
            },
            hidden: {
              type: GraphQLBoolean,
              description: 'Is hidden',
              defaultValue: false,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('contract.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contractService = container.model.contractService();
    const contract = await contractService.contractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    const {
      blockchain,
      network,
      address,
      deployBlockNumber,
      adapter,
      layout,
      automates,
      autorestakeAdapter,
      name,
      description,
      link,
      hidden,
    } = input;
    const updated = await contractService.update({
      ...contract,
      blockchain: (typeof blockchain === 'string' ? blockchain : contract.blockchain) as Blockchain,
      network: typeof network === 'string' ? network : contract.network,
      address: typeof address === 'string' ? address : contract.address,
      deployBlockNumber:
        typeof deployBlockNumber === 'string' ? deployBlockNumber : contract.deployBlockNumber,
      adapter: typeof adapter === 'string' ? adapter : contract.adapter,
      layout: typeof layout === 'string' ? layout : contract.layout,
      automate: {
        adapters: Array.isArray(automates) ? automates : contract.automate.adapters,
        autorestakeAdapter:
          typeof autorestakeAdapter === 'string'
            ? autorestakeAdapter
            : contract.automate.autorestakeAdapter,
      },
      name: typeof name === 'string' ? name : contract.name,
      description: typeof description === 'string' ? description : contract.description,
      link: typeof link === 'string' ? link : contract.link,
      hidden: typeof hidden === 'boolean' ? hidden : contract.hidden,
    });

    return updated;
  }),
};

export const ContractDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('contract.delete', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contractService = container.model.contractService();
    const contract = await contractService.contractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    await contractService.delete(contract);

    return true;
  }),
};

export const ContractWalletLinkMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    contract: {
      type: GraphQLNonNull(UuidType),
      description: 'Target contract',
    },
    wallet: {
      type: GraphQLNonNull(UuidType),
      description: 'Target wallet',
    },
  },
  resolve: async (root, { contract: contractId, wallet: walletId }, { currentUser, acl }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.contractTable().where('id', contractId).first();
    if (!contract) throw new UserInputError('Contract not found');

    const blockchainWallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.id`, walletId)
      .first();
    if (!blockchainWallet) throw new UserInputError('Wallet not found');

    if (blockchainWallet.blockchain !== contract.blockchain)
      throw new UserInputError('Invalid blockchain');
    if (blockchainWallet.network !== contract.network) throw new UserInputError('Invalid network');
    if (
      !(blockchainWallet.user === currentUser.id && acl.isAllowed('contract', 'walletLink-own')) &&
      !acl.isAllowed('contract', 'walletLink')
    ) {
      throw new ForbiddenError('FORBIDDEN');
    }

    await container.model.contractService().walletLink(contract, blockchainWallet);

    return true;
  },
};

export const ContractWalletUnlinkMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    contract: {
      type: GraphQLNonNull(UuidType),
      description: 'Target contract',
    },
    wallet: {
      type: GraphQLNonNull(UuidType),
      description: 'Target wallet',
    },
  },
  resolve: async (root, { contract: contractId, wallet: walletId }, { currentUser, acl }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.contractTable().where('id', contractId).first();
    if (!contract) throw new UserInputError('Contract not found');

    const wallet = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.id`, walletId)
      .first();
    if (!wallet) throw new UserInputError('Wallet not found');

    if (wallet.blockchain !== contract.blockchain) throw new UserInputError('Invalid blockchain');
    if (wallet.network !== contract.network) throw new UserInputError('Invalid network');
    if (
      !(wallet.user === currentUser.id && acl.isAllowed('contract', 'walletLink-own')) &&
      !acl.isAllowed('contract', 'walletLink')
    ) {
      throw new ForbiddenError('FORBIDDEN');
    }

    await container.model.contractService().walletUnlink(contract, wallet);

    return true;
  },
};

export const ProtocolLinkType = new GraphQLObjectType<ProtocolLink>({
  name: 'ProtocolLinkType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    value: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Value',
    },
  },
});

export const ProtocolLinkMapType = new GraphQLObjectType<ProtocolLinkMap>({
  name: 'ProtocolLinkMapType',
  fields: {
    social: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ProtocolLinkType))),
      resolve: ({ social }) => social ?? [],
    },
    listing: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ProtocolLinkType))),
      resolve: ({ listing }) => listing ?? [],
    },
    audit: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ProtocolLinkType))),
      resolve: ({ audit }) => audit ?? [],
    },
    other: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(ProtocolLinkType))),
      resolve: ({ other }) => other ?? [],
    },
  },
});

export const ProtocolSocialPostProviderEnum = new GraphQLEnumType({
  name: 'ProtocolSocialPostProviderEnum',
  values: Object.values(PostProvider).reduce(
    (prev, name) => ({ ...prev, [name]: { value: name } }),
    {},
  ),
});

export const ProtocolSocialPostType = new GraphQLObjectType<Post>({
  name: 'ProtocolSocialPostType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    provider: {
      type: GraphQLNonNull(ProtocolSocialPostProviderEnum),
      description: 'Provider',
    },
    title: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Title',
    },
    content: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Content (maybe HTML)',
    },
    link: {
      type: GraphQLNonNull(GraphQLString),
      description: 'URL',
    },
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const ProtocolMetricType = new GraphQLObjectType({
  name: 'ProtocolMetricType',
  fields: {
    tvl: {
      type: GraphQLNonNull(GraphQLString),
    },
    uniqueWalletsCount: {
      type: GraphQLNonNull(GraphQLString),
    },
    myAPY: {
      type: GraphQLNonNull(GraphQLString),
    },
    myStaked: {
      type: GraphQLNonNull(GraphQLString),
    },
    myEarned: {
      type: GraphQLNonNull(GraphQLString),
    },
    myAPYBoost: {
      type: GraphQLNonNull(GraphQLString),
    },
    myMinUpdatedAt: {
      type: DateTimeType,
    },
  },
});

export const ProtocolType = new GraphQLObjectType<Protocol, Request>({
  name: 'ProtocolType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    adapter: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Adapter name',
    },
    debankId: {
      type: GraphQLString,
      description: 'Debank Identifier',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Description',
    },
    icon: {
      type: GraphQLString,
      description: 'Icon image URL',
    },
    link: {
      type: GraphQLString,
      description: 'Website URL',
    },
    links: {
      type: GraphQLNonNull(ProtocolLinkMapType),
      description: 'Links',
    },
    hidden: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is hidden',
    },
    previewPicture: {
      type: GraphQLString,
      description: 'Preview picture',
    },
    favorite: {
      type: GraphQLNonNull(GraphQLBoolean),
      resolve: async (protocol, args, { currentUser, dataLoader }) => {
        if (!currentUser) return false;

        return dataLoader.protocolFavorites({ userId: currentUser.id }).load(protocol.id);
      },
    },
    contracts: {
      type: GraphQLNonNull(PaginateList('ContractListType', GraphQLNonNull(ContractType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'ContractListFilterInputType',
            fields: {
              id: {
                type: UuidType,
              },
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
          'ContractListSortInputType',
          ['id', 'name', 'address', 'createdAt', 'tvl', 'aprYear', 'myStaked'],
          [{ column: 'name', order: 'asc' }],
        ),
        pagination: PaginationArgument('ContractListPaginationInputType'),
      },
      resolve: async (protocol, { filter, sort, pagination }, { currentUser }) => {
        const select = container.model
          .contractTable()
          .column(`${contractTableName}.*`)
          .where(function () {
            const { id, hidden, search } = filter;
            if (id) {
              this.where('id', id);
            } else {
              this.where('protocol', protocol.id);
              if (filter.blockchain !== undefined) {
                const { protocol: blockchain, network } = filter.blockchain;
                this.andWhere('blockchain', blockchain);
                if (network !== undefined) {
                  this.andWhere('network', network);
                }
              }
              if (typeof hidden === 'boolean') {
                this.andWhere('hidden', hidden);
              }
              if (search !== undefined && search !== '') {
                this.andWhere(function () {
                  this.where('name', 'iLike', `%${search}%`);
                  this.orWhere('address', 'iLike', `%${search}%`);
                });
              }
            }
          });
        let listSelect = select.clone();
        const sortColumns = sort.map(({ column }: { column: string }) => column);
        const database = container.database();
        if (sortColumns.includes('myStaked')) {
          if (currentUser) {
            listSelect = listSelect
              .column(database.raw(`COALESCE(metric."myStaked", '0') AS "myStaked"`))
              .leftJoin(
                container.model
                  .metricWalletTable()
                  .distinctOn(`${metricWalletTableName}.contract`)
                  .column(`${metricWalletTableName}.contract`)
                  .column(
                    database.raw(`${metricWalletTableName}.data->>'stakingUSD' AS "myStaked"`),
                  )
                  .innerJoin(
                    walletTableName,
                    `${walletTableName}.id`,
                    `${metricWalletTableName}.wallet`,
                  )
                  .where(`${walletTableName}.user`, currentUser.id)
                  .andWhere(database.raw(`${metricWalletTableName}.contract = contract`))
                  .orderBy(`${metricWalletTableName}.contract`)
                  .orderBy(`${metricWalletTableName}.date`, 'DESC')
                  .as('metric'),
                `${contractTableName}.id`,
                'metric.contract',
              );
          } else {
            listSelect = listSelect
              .column(`${contractTableName}.*`)
              .column(database.raw(`'0' AS "myStaked"`));
          }
        }
        if (sortColumns.includes('tvl')) {
          listSelect = listSelect.column(
            database.raw(`(COALESCE(${contractTableName}.metric->>'tvl', '0'))::numeric AS "tvl"`),
          );
        }
        if (sortColumns.includes('aprYear')) {
          listSelect = listSelect.column(
            database.raw(
              `(COALESCE(${contractTableName}.metric->>'aprYear', '0'))::numeric AS "aprYear"`,
            ),
          );
        }

        return {
          list: await listSelect
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
            name: 'ProtocolMetricChartFilterInputType',
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
          'ProtocolMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('ProtocolMetricChartPaginationInputType'),
      },
      resolve: async (protocol, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        const select = container.model
          .metricProtocolTable()
          .distinctOn('provider', 'entityIdentifier', 'date')
          .column(database.raw(`(${metricProtocolTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`'${metric}' AS provider`))
          .column(
            database.raw(
              `${metricProtocolTableName}.data->>'entityIdentifier' AS "entityIdentifier"`,
            ),
          )
          .column(database.raw(`DATE_TRUNC('${group}', ${metricProtocolTableName}.date) AS "date"`))
          .where(function () {
            this.where(`${metricProtocolTableName}.protocol`, protocol.id).andWhere(
              database.raw(`${metricProtocolTableName}.data->>'${metric}' IS NOT NULL`),
            );

            if (filter.dateAfter) {
              this.andWhere(`${metricProtocolTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricProtocolTableName}.date`, '<', filter.dateBefore.toDate());
            }
          });

        return container
          .database()
          .column('date')
          .column('provider')
          .column('entityIdentifier')
          .max({ max: 'value' })
          .min({ min: 'value' })
          .count({ count: 'value' })
          .avg({ avg: 'value' })
          .sum({ sum: 'value' })
          .from(select.as('metric'))
          .groupBy('provider', 'entityIdentifier', 'date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
      },
    },
    metricChartProtocols: {
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
            name: 'ProtocolMetricChartProtocolsFilterInputType',
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
          'ProtocolMetricChartProtocolsSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'desc' }],
        ),
        pagination: PaginationArgument('ProtocolMetricChartProtocolsPaginationInputType'),
      },
      resolve: async (protocol, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        const select = container.model
          .metricProtocolTable()
          .distinctOn(`date`)
          .column(database.raw(`(${metricProtocolTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricProtocolTableName}.date) AS "date"`))
          .where(function () {
            this.where(`${metricProtocolTableName}.protocol`, protocol.id).andWhere(
              database.raw(`${metricProtocolTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.dateAfter) {
              this.andWhere(`${metricProtocolTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricProtocolTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy('date')
          .orderBy(`${metricProtocolTableName}.date`, 'DESC');

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
    metricChartContracts: {
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
            name: 'ProtocolMetricChartContractsFilterInputType',
            fields: {
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
          'ProtocolMetricChartContractsSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('ProtocolMetricChartContractsPaginationInputType'),
      },
      resolve: async (protocol, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        const select = container.model
          .metricContractTable()
          .distinctOn(`${metricContractTableName}.contract`, 'date')
          .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricContractTableName}.date) AS "date"`))
          .innerJoin(
            contractTableName,
            `${contractTableName}.id`,
            `${metricContractTableName}.contract`,
          )
          .where(function () {
            this.where(`${contractTableName}.protocol`, protocol.id).andWhere(
              database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (filter.blockchain) {
              const { protocol: blockchain, network } = filter.blockchain;
              this.andWhere(`${contractTableName}.blockchain`, blockchain);
              if (network !== undefined) {
                this.andWhere(`${contractTableName}.network`, network);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricContractTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricContractTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricContractTableName}.contract`)
          .orderBy('date')
          .orderBy(`${metricContractTableName}.date`, 'DESC');

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
    metricChartUsers: {
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
            name: 'ProtocolMetricChartUsersFilterInputType',
            fields: {
              user: {
                type: GraphQLNonNull(GraphQLList(UuidType)),
                description: 'Target users id',
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
          'ProtocolMetricChartUsersSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('ProtocolMetricChartUsersPaginationInputType'),
      },
      resolve: async (protocol, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        const select = container.model
          .metricWalletTable()
          .distinctOn(
            `${metricWalletTableName}.contract`,
            `${metricWalletTableName}.wallet`,
            'date',
          )
          .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS value`))
          .column(database.raw(`DATE_TRUNC('${group}', ${metricWalletTableName}.date) AS "date"`))
          .innerJoin(
            contractTableName,
            `${contractTableName}.id`,
            `${metricWalletTableName}.contract`,
          )
          .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
          .where(function () {
            this.where(`${contractTableName}.protocol`, protocol.id).andWhere(
              database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`),
            );
            if (Array.isArray(filter.user) && filter.user.length > 0) {
              this.whereIn(`${walletTableName}.user`, filter.user);
            }
            if (filter.blockchain) {
              const { protocol: blockchain, network } = filter.blockchain;
              this.andWhere(`${contractTableName}.blockchain`, blockchain);
              if (network !== undefined) {
                this.andWhere(`${contractTableName}.network`, network);
              }
            }
            if (filter.dateAfter) {
              this.andWhere(`${metricWalletTableName}.date`, '>=', filter.dateAfter.toDate());
            }
            if (filter.dateBefore) {
              this.andWhere(`${metricWalletTableName}.date`, '<', filter.dateBefore.toDate());
            }
          })
          .orderBy(`${metricWalletTableName}.contract`)
          .orderBy(`${metricWalletTableName}.wallet`)
          .orderBy('date')
          .orderBy(`${metricWalletTableName}.date`, 'DESC');

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
      type: GraphQLNonNull(ProtocolMetricType),
      resolve: async (protocol, args, { currentUser, dataLoader }) => {
        const metric = {
          tvl:
            protocol.adapter === 'debankByApiReadonly'
              ? protocol.metric?.tvl ?? '0'
              : await dataLoader.protocolMetric({ metric: 'tvl' }).load(protocol.id),
          uniqueWalletsCount: await dataLoader
            .protocolMetric({ metric: 'uniqueWalletsCount' })
            .load(protocol.id),
          myAPY: '0',
          myStaked: '0',
          myEarned: '0',
          myAPYBoost: '0',
        };
        if (!currentUser) return metric;

        const userMetric = await dataLoader
          .protocolUserMetric({ userId: currentUser.id })
          .load(protocol.id);
        const userApy = await dataLoader
          .protocolUserAPRMetric({ metric: 'aprYear', userId: currentUser.id })
          .load(protocol.id);
        const totalBalance = new BN(userMetric.stakingUSD).plus(userMetric.earnedUSD).toNumber();
        return {
          ...metric,
          myAPY: userApy,
          myStaked: userMetric.stakingUSD,
          myEarned: userMetric.earnedUSD,
          myAPYBoost: await apyBoost(
            'ethereum',
            '43114',
            totalBalance > 0 ? totalBalance : 10000,
            new BN(userApy).toNumber(),
          ),
          myMinUpdatedAt: userMetric.minUpdatedAt ? dayjs(userMetric.minUpdatedAt) : null,
        };
      },
    },
    socialPosts: {
      type: GraphQLNonNull(
        PaginateList('ProtocolSocialPostListType', GraphQLNonNull(ProtocolSocialPostType)),
      ),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'ProtocolSocialPostListFilterInputType',
            fields: {
              provider: {
                type: ProtocolSocialPostProviderEnum,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'ProtocolSocialPostListSortInputType',
          ['id', 'title', 'createdAt'],
          [{ column: 'createdAt', order: 'desc' }],
        ),
        pagination: PaginationArgument('ProtocolSocialPostListPaginationInputType'),
      },
      resolve: async (protocol, { filter, sort, pagination }) => {
        const select = container.model.protocolSocialPostTable().where(function () {
          this.where('protocol', protocol.id);

          const { provider } = filter;
          if (typeof provider === 'string') {
            this.andWhere('provider', provider);
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
    createdAt: {
      type: GraphQLNonNull(DateTimeType),
      description: 'Date of created',
    },
  },
});

export const ProtocolQuery: GraphQLFieldConfig<any, Request> = {
  type: ProtocolType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolFilterInputType',
          fields: {
            id: {
              type: UuidType,
            },
            adapter: {
              type: GraphQLString,
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }) => {
    if (typeof filter.id === 'string') {
      return container.model.protocolTable().where('id', filter.id).first();
    }
    if (typeof filter.adapter === 'string') {
      return container.model.protocolTable().where('adapter', filter.adapter).first();
    }
    return null;
  },
};

export const ProtocolListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('ProtocolListQuery', GraphQLNonNull(ProtocolType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'ProtocolListFilterInputType',
        fields: {
          blockchain: {
            type: BlockchainFilterInputType,
          },
          linked: {
            type: UuidType,
            description: 'Target user ID',
          },
          favorite: {
            type: GraphQLBoolean,
            description: 'Is favorite',
          },
          hidden: {
            type: GraphQLBoolean,
          },
          search: {
            type: GraphQLString,
          },
          isDebank: {
            type: GraphQLBoolean,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'ProtocolListSortInputType',
      ['id', 'name', 'address', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('ProtocolListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }, { currentUser }) => {
    const select = container.model.protocolTable().where(function () {
      const { blockchain, linked, favorite, hidden, isDebank, search } = filter;
      if (blockchain !== undefined) {
        const { protocol, network } = blockchain;
        const contractSelect = container.model
          .contractTable()
          .columns('protocol')
          .where(function () {
            this.andWhere('blockchain', protocol);
            if (network !== undefined) {
              this.andWhere('network', network);
            }
          });
        this.whereIn('id', contractSelect);
      }
      if (typeof favorite === 'boolean') {
        const favoriteSelect = container.model
          .protocolUserFavoriteTable()
          .column('protocol')
          .where('user', currentUser ? currentUser.id : '');
        if (favorite === true) {
          this.whereIn('id', favoriteSelect);
        } else {
          this.whereNotIn('id', favoriteSelect);
        }
      }
      if (linked !== undefined) {
        this.whereIn(
          'id',
          container.model
            .contractTable()
            .column('protocol')
            .innerJoin(
              walletContractLinkTableName,
              `${contractTableName}.id`,
              `${walletContractLinkTableName}.contract`,
            )
            .innerJoin(
              walletTableName,
              `${walletContractLinkTableName}.wallet`,
              `${walletTableName}.id`,
            )
            .where(`${walletTableName}.user`, linked),
        );
      }
      if (typeof hidden === 'boolean') {
        this.andWhere('hidden', hidden);
      }

      if (typeof isDebank === 'boolean') {
        if (isDebank === true) {
          this.andWhere('adapter', 'debankByApiReadonly');
        } else {
          this.andWhereNot('adapter', 'debankByApiReadonly');
        }
      }

      if (search !== undefined && search !== '') {
        this.andWhere('name', 'iLike', `%${search}%`);
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

export const ProtocolLinkInputType = new GraphQLInputObjectType({
  name: 'ProtocolLinkInputType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Name',
    },
    value: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Value',
    },
  },
});

export const ProtocolLinkMapInputType = new GraphQLInputObjectType({
  name: 'ProtocolLinkMapInputType',
  fields: {
    social: {
      type: GraphQLList(GraphQLNonNull(ProtocolLinkInputType)),
    },
    listing: {
      type: GraphQLList(GraphQLNonNull(ProtocolLinkInputType)),
    },
    audit: {
      type: GraphQLList(GraphQLNonNull(ProtocolLinkInputType)),
    },
    other: {
      type: GraphQLList(GraphQLNonNull(ProtocolLinkInputType)),
    },
  },
});

export const ProtocolCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProtocolType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolCreateInputType',
          fields: {
            adapter: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Adapter name',
            },
            name: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Name',
            },
            description: {
              type: GraphQLString,
              description: 'Description',
              defaultValue: '',
            },
            icon: {
              type: GraphQLString,
              description: 'Icon image URL',
              defaultValue: null,
            },
            link: {
              type: GraphQLString,
              description: 'Website URL',
              defaultValue: null,
            },
            links: {
              type: ProtocolLinkMapInputType,
              description: 'Links',
              defaultValue: {},
            },
            hidden: {
              type: GraphQLBoolean,
              description: 'Is hidden',
              defaultValue: false,
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('protocol.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { adapter, name, description, icon, link, links, hidden } = input;
    const created = await container.model
      .protocolService()
      .create(adapter, name, description, icon, null, link, links, hidden);

    return created;
  }),
};

export const ProtocolUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProtocolType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolUpdateInputType',
          fields: {
            adapter: {
              type: GraphQLString,
              description: 'Adapter name',
            },
            name: {
              type: GraphQLString,
              description: 'Name',
            },
            description: {
              type: GraphQLString,
              description: 'Description',
            },
            icon: {
              type: GraphQLString,
              description: 'Icon image URL',
            },
            previewPicture: {
              type: GraphQLString,
              description: 'Preview picture URL',
            },
            link: {
              type: GraphQLString,
              description: 'Website URL',
            },
            links: {
              type: ProtocolLinkMapInputType,
              description: 'Links',
            },
            hidden: {
              type: GraphQLBoolean,
              description: 'Is hidden',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('protocol.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const protocol = await container.model.protocolTable().where('id', id).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const { adapter, name, description, icon, link, links, hidden, previewPicture } = input;
    const updated = await container.model.protocolService().update({
      ...protocol,
      adapter: typeof adapter === 'string' ? adapter : protocol.adapter,
      name: typeof name === 'string' ? name : protocol.name,
      description: typeof description === 'string' ? description : protocol.description,
      icon: typeof icon === 'string' ? icon : protocol.icon,
      link: typeof link === 'string' ? link : protocol.link,
      links: typeof links === 'object' ? links : protocol.links,
      hidden: typeof hidden === 'boolean' ? hidden : protocol.hidden,
      previewPicture: typeof previewPicture === 'string' ? previewPicture : protocol.previewPicture,
    });

    return updated;
  }),
};

export const ProtocolDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('protocol.delete', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const protocol = await container.model.protocolTable().where('id', id).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    await container.model.protocolService().delete(protocol);

    return true;
  }),
};

export const ContractScannerRegisterMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    events: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
    },
  },
  resolve: onlyAllowed('contract.update', async (root, { id, events }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.contractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    await container.model
      .queueService()
      .push('registerContractInScanner', { contract: contract.id, events });

    return true;
  }),
};

export const ProtocolResolveContractsMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolResolveContractsInputType',
          fields: {
            blockchain: {
              type: GraphQLNonNull(BlockchainEnum),
              description: 'Blockchain type',
            },
            network: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Blockchain network id',
            },
            events: {
              type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
              description: 'Blockchain network id',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('protocol.update', async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const protocol = await container.model.protocolTable().where('id', id).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const { blockchain, network, events } = input;

    await container.model.queueService().push('protocolContractsResolver', {
      protocolId: protocol.id,
      protocolBlockchain: blockchain,
      protocolNetwork: network,
      events,
    });

    return true;
  }),
};

export const ProtocolFavoriteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolFavoriteInputType',
          fields: {
            protocol: {
              type: GraphQLNonNull(UuidType),
              description: 'Target protocol',
            },
            favorite: {
              type: GraphQLNonNull(GraphQLBoolean),
              description: 'Is favorite',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('protocol.favorite', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { protocol: protocolId, favorite } = input;
    const protocol = await container.model.protocolTable().where('id', protocolId).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const protocolService = container.model.protocolService();
    if (favorite) {
      await protocolService.addFavorite(protocol, currentUser);
    } else {
      await protocolService.removeFavorite(protocol, currentUser);
    }

    return true;
  }),
};
