import container from '@container';
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
import { Contract, Protocol } from '@models/Protocol/Entity';
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { Role } from '@models/User/Entity';
import { Blockchain } from '@models/types';

export const ContractType = new GraphQLObjectType<Contract>({
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
        let select = container.model
          .metricContractTable()
          .column(database.raw(`DATE_TRUNC('${group}', "date") AS "date"`))
          .column(database.raw(`COUNT((data->>'${metric}')::numeric) AS "count"`))
          .column(database.raw(`SUM((data->>'${metric}')::numeric) AS "sum"`))
          .column(database.raw(`AVG((data->>'${metric}')::numeric) AS "avg"`))
          .column(database.raw(`MAX((data->>'${metric}')::numeric) AS "max"`))
          .column(database.raw(`MIN((data->>'${metric}')::numeric) AS "min"`))
          .where('contract', contract.id)
          .groupBy('date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
        if (filter.dateAfter) {
          select = select.andWhere('date', '>=', filter.dateAfter.toDate());
        }
        if (filter.dateBefore) {
          select = select.andWhere('date', '<', filter.dateBefore.toDate());
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
          },
        }),
      ),
    },
  },
  resolve: async (root, { protocol: protocolId, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

    const protocol = await container.model.protocolTable().where('id', protocolId).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const {
      blockchain,
      network,
      address,
      deployBlockNumber,
      adapter,
      layout,
      name,
      description,
      link,
      hidden,
    } = input;
    const created = await container.model
      .contractService()
      .create(
        protocol,
        blockchain,
        network,
        address,
        deployBlockNumber,
        adapter,
        layout,
        name,
        description,
        link,
        hidden,
      );

    return created;
  },
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
  resolve: async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

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
      name: typeof name === 'string' ? name : contract.name,
      description: typeof description === 'string' ? description : contract.description,
      link: typeof link === 'string' ? link : contract.link,
      hidden: typeof hidden === 'boolean' ? hidden : contract.hidden,
    });

    return updated;
  },
};

export const ContractDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

    const contractService = container.model.contractService();
    const contract = await contractService.contractTable().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    await contractService.delete(contract);

    return true;
  },
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
  resolve: async (root, { contract: contractId, wallet: walletId }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.contractTable().where('id', contractId).first();
    if (!contract) throw new UserInputError('Contract not found');

    const wallet = await container.model.walletTable().where('id', walletId).first();
    if (!wallet) throw new UserInputError('Wallet not found');

    if (wallet.blockchain !== contract.blockchain) throw new UserInputError('Invalid blockchain');
    if (wallet.network !== contract.network) throw new UserInputError('Invalid network');
    if (wallet.user !== currentUser.id && currentUser.role !== Role.Admin) {
      throw new ForbiddenError('FORBIDDEN');
    }

    await container.model.contractService().walletLink(contract, wallet);

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
  resolve: async (root, { contract: contractId, wallet: walletId }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const contract = await container.model.contractTable().where('id', contractId).first();
    if (!contract) throw new UserInputError('Contract not found');

    const wallet = await container.model.walletTable().where('id', walletId).first();
    if (!wallet) throw new UserInputError('Wallet not found');

    if (wallet.blockchain !== contract.blockchain) throw new UserInputError('Invalid blockchain');
    if (wallet.network !== contract.network) throw new UserInputError('Invalid network');
    if (wallet.user !== currentUser.id && currentUser.role !== Role.Admin) {
      throw new ForbiddenError('FORBIDDEN');
    }

    await container.model.contractService().walletUnlink(contract, wallet);

    return true;
  },
};

export const ProtocolType = new GraphQLObjectType<Protocol>({
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
    hidden: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is hidden',
    },
    contracts: {
      type: GraphQLNonNull(PaginateList('ContractListType', GraphQLNonNull(ContractType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'ContractListFilterInputType',
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
          'ContractListSortInputType',
          ['id', 'name', 'address', 'createdAt'],
          [{ column: 'name', order: 'asc' }],
        ),
        pagination: PaginationArgument('ContractListPaginationInputType'),
      },
      resolve: async (protocol, { filter, sort, pagination }) => {
        let select = container.model.contractTable().where('protocol', protocol.id);
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
            name: 'ProtocolMetricChartFilterInputType',
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
          'ProtocolMetricChartSortInputType',
          ['date', 'value'],
          [{ column: 'date', order: 'asc' }],
        ),
        pagination: PaginationArgument('ProtocolMetricChartPaginationInputType'),
      },
      resolve: async (protocol, { metric, group, filter, sort, pagination }) => {
        const database = container.database();
        let contractSelect = container.model
          .contractTable()
          .columns('id')
          .where('protocol', protocol.id);
        if (filter.blockchain) {
          const { protocol, network } = filter.blockchain;
          contractSelect = contractSelect.andWhere('blockchain', protocol);
          if (network !== undefined) {
            contractSelect = contractSelect.andWhere('network', network);
          }
        }

        let select = container.model
          .metricContractTable()
          .column(database.raw(`DATE_TRUNC('${group}', "date") AS "date"`))
          .column(database.raw(`COUNT((data->>'${metric}')::numeric) AS "count"`))
          .column(database.raw(`SUM((data->>'${metric}')::numeric) AS "sum"`))
          .column(database.raw(`AVG((data->>'${metric}')::numeric) AS "avg"`))
          .column(database.raw(`MAX((data->>'${metric}')::numeric) AS "max"`))
          .column(database.raw(`MIN((data->>'${metric}')::numeric) AS "min"`))
          .whereIn('contract', contractSelect)
          .groupBy('date')
          .orderBy(sort)
          .limit(pagination.limit)
          .offset(pagination.offset);
        if (filter.dateAfter) {
          select = select.andWhere('date', '>=', filter.dateAfter.toDate());
        }
        if (filter.dateBefore) {
          select = select.andWhere('date', '<', filter.dateBefore.toDate());
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

export const ProtocolQuery: GraphQLFieldConfig<any, Request> = {
  type: ProtocolType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProtocolFilterInputType',
          fields: {
            id: {
              type: GraphQLNonNull(GraphQLString),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }, { currentUser }) => {
    return container.model.protocolTable().where('id', filter.id).first();
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
      'ProtocolListSortInputType',
      ['id', 'name', 'address', 'createdAt'],
      [{ column: 'name', order: 'asc' }],
    ),
    pagination: PaginationArgument('ProtocolListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    let select = container.model.protocolTable();
    if (filter.blockchain !== undefined) {
      const { protocol, network } = filter.blockchain;
      let contractSelect = container.model.contractTable().columns('protocol');
      contractSelect = contractSelect.andWhere('blockchain', protocol);
      if (network !== undefined) {
        contractSelect = contractSelect.andWhere('network', network);
      }
      select.whereIn('id', contractSelect);
    }
    if (filter.hidden !== undefined) {
      select = select.andWhere('hidden', filter.hidden);
    }
    if (filter.search !== undefined && filter.search !== '') {
      select = select.andWhere('name', 'iLike', `%${filter.search}%`);
    }

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};

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
  resolve: async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

    const { adapter, name, description, icon, link, hidden } = input;
    const created = await container.model
      .protocolService()
      .create(adapter, name, description, icon, link, hidden);

    return created;
  },
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
            link: {
              type: GraphQLString,
              description: 'Website URL',
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
  resolve: async (root, { id, input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

    const protocolService = container.model.protocolService();
    const protocol = await protocolService.table().where('id', id).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    const { adapter, name, description, icon, link, hidden } = input;
    const updated = await protocolService.update({
      ...protocol,
      adapter: typeof adapter === 'string' ? adapter : protocol.adapter,
      name: typeof name === 'string' ? name : protocol.name,
      description: typeof description === 'string' ? description : protocol.description,
      icon: typeof icon === 'string' ? icon : protocol.icon,
      link: typeof link === 'string' ? link : protocol.link,
      hidden: typeof hidden === 'boolean' ? hidden : protocol.hidden,
    });

    return updated;
  },
};

export const ProtocolDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');
    if (currentUser.role !== Role.Admin) throw new ForbiddenError('FORBIDDEN');

    const protocolService = container.model.protocolService();
    const protocol = await protocolService.table().where('id', id).first();
    if (!protocol) throw new UserInputError('Protocol not found');

    await protocolService.delete(protocol);

    return true;
  },
};
