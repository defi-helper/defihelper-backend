import container from '@container';
import { Request } from 'express';
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import {
  BlockchainEnum,
  BlockchainFilterInputType,
  DateTimeType,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
} from '../types';
import { protocolTableName } from '@models/Protocol/Entity';
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import { Role } from '@models/User/Entity';
import { Blockchain } from '@models/types';

export const ContractType = new GraphQLObjectType({
  name: 'ContractType',
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

    const { blockchain, network, address, name, description, link, hidden } = input;
    const created = await container.model
      .contractService()
      .create(protocol, blockchain, network, address, name, description, link, hidden);

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
    const contract = await contractService.table().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    const { blockchain, network, address, name, description, link, hidden } = input;
    const updated = await contractService.update({
      ...contract,
      blockchain: (typeof blockchain === 'string' ? blockchain : contract.blockchain) as Blockchain,
      network: typeof network === 'string' ? network : contract.network,
      address: typeof address === 'string' ? address : contract.address,
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
    const contract = await contractService.table().where('id', id).first();
    if (!contract) throw new UserInputError('Contract not found');

    await contractService.delete(contract);

    return true;
  },
};

export const ProtocolType = new GraphQLObjectType({
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
      select = select.andWhere(`${protocolTableName}.hidden`, filter.hidden);
    }
    if (filter.search !== undefined && filter.search !== '') {
      select = select.andWhere(`${protocolTableName}.name`, 'iLike', `%${filter.search}%`);
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

    const { name, description, icon, link, hidden } = input;
    const created = await container.model
      .protocolService()
      .create('', name, description, icon, link, hidden);

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

    const { name, description, icon, link, hidden } = input;
    const updated = await protocolService.update({
      ...protocol,
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
