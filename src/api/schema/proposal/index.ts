import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { UserType } from '@api/schema/user';
import { Status, Proposal, Vote } from '@models/Proposal/Entity';
import container from '@container';
import { Request } from 'express';
import { AuthenticationError, ForbiddenError, UserInputError } from 'apollo-server-express';
import {
  DateTimeType,
  PaginateList,
  PaginationArgument,
  SortArgument,
  UuidType,
  onlyAllowed,
} from '../types';

export const VoteType = new GraphQLObjectType<Vote>({
  name: 'VoteType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    user: {
      type: GraphQLNonNull(UserType),
      description: 'Voting user',
      resolve: (vote) => {
        return container.model.userTable().where('id', vote.user).first();
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

export const VoteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(VoteType),
  args: {
    proposal: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: async (root, { proposal: proposalId }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const proposal = await container.model.proposalTable().where('id', proposalId).first();
    if (!proposal) throw new UserInputError('Proposal not found');

    return container.model.proposalService().vote(proposal, currentUser);
  },
};

export const UnvoteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    proposal: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: async (root, { proposal: proposalId }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const proposal = await container.model.proposalTable().where('id', proposalId).first();
    if (!proposal) throw new UserInputError('Proposal not found');

    await container.model.proposalService().unvote(proposal, currentUser);
    return true;
  },
};

export const StatusEnum = new GraphQLEnumType({
  name: 'ProposalStatusEnum',
  values: {
    [Status.Open]: {
      description: 'Proposal is open for vote',
    },
    [Status.InProcess]: {
      description: 'Proposal in process',
    },
    [Status.Executed]: {
      description: 'Proposal is executed',
    },
    [Status.Defeated]: {
      description: 'Proposal is defeated',
    },
  },
});

export const ProposalType = new GraphQLObjectType<Proposal>({
  name: 'ProposalType',
  fields: {
    id: {
      type: GraphQLNonNull(UuidType),
      description: 'Identificator',
    },
    title: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Title',
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Description',
    },
    status: {
      type: GraphQLNonNull(StatusEnum),
      description: 'Current status',
    },
    author: {
      type: UserType,
      description: 'Author',
      resolve: (proposal) => {
        return container.model.userTable().where('id', proposal.author).first();
      },
    },
    votes: {
      type: GraphQLNonNull(PaginateList('VoteListType', GraphQLNonNull(VoteType))),
      args: {
        filter: {
          type: new GraphQLInputObjectType({
            name: 'VoteListFilterInputType',
            fields: {
              user: {
                type: UuidType,
              },
            },
          }),
          defaultValue: {},
        },
        sort: SortArgument(
          'VoteListSortInputType',
          ['id', 'createdAt'],
          [{ column: 'createdAt', order: 'asc' }],
        ),
        pagination: PaginationArgument('VoteListPaginationInputType'),
      },
      resolve: async (proposal, { filter, sort, pagination }) => {
        let select = container.model.voteTable().where('proposal', proposal.id);
        if (filter.user !== undefined) {
          select = select.andWhere('user', filter.user);
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
    plannedAt: {
      type: DateTimeType,
      description: 'Planned date',
    },
    releasedAt: {
      type: DateTimeType,
      description: 'Released date',
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

export const ProposalQuery: GraphQLFieldConfig<any, Request> = {
  type: ProposalType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProposalFilterInputType',
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
    return container.model.proposalTable().where('id', filter.id).first();
  },
};

export const ProposalListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('ProposalListQuery', GraphQLNonNull(ProposalType))),
  args: {
    filter: {
      type: new GraphQLInputObjectType({
        name: 'ProposalListFilterInputType',
        fields: {
          author: {
            type: UuidType,
          },
          status: {
            type: StatusEnum,
          },
          search: {
            type: GraphQLString,
          },
        },
      }),
      defaultValue: {},
    },
    sort: SortArgument(
      'ProposalListSortInputType',
      ['id', 'title', 'createdAt'],
      [{ column: 'title', order: 'asc' }],
    ),
    pagination: PaginationArgument('ProposalListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    let select = container.model.proposalTable();
    if (filter.author !== undefined) {
      select = select.andWhere('author', filter.author);
    }
    if (filter.status !== undefined) {
      select = select.andWhere('status', filter.status);
    }
    if (filter.search !== undefined && filter.search !== '') {
      select = select.andWhere(`title`, 'iLike', `%${filter.search}%`);
    }

    return {
      list: await select.clone().orderBy(sort).limit(pagination.limit).offset(pagination.offset),
      pagination: {
        count: await select.clone().count().first(),
      },
    };
  },
};

export const ProposalCreateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProposalType),
  args: {
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProposalCreateInputType',
          fields: {
            title: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Title',
            },
            description: {
              type: GraphQLNonNull(GraphQLString),
              description: 'Description',
            },
          },
        }),
      ),
    },
  },
  resolve: onlyAllowed('proposal.create', async (root, { input }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const { title, description } = input;
    const created = await container.model.proposalService().create(title, description, currentUser);

    return created;
  }),
};

export const ProposalUpdateMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(ProposalType),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
    input: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'ProposalUpdateInputType',
          fields: {
            title: {
              type: GraphQLString,
              description: 'Title',
            },
            description: {
              type: GraphQLString,
              description: 'Description',
            },
            status: {
              type: StatusEnum,
              description: 'Current status',
            },
            plannedAt: {
              type: DateTimeType,
              description: 'Planned date',
            },
            releasedAt: {
              type: DateTimeType,
              description: 'Released date',
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { id, input }, { currentUser, acl }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const proposalService = container.model.proposalService();
    const proposal = await proposalService.proposalTable().where('id', id).first();
    if (!proposal) throw new UserInputError('Proposal not found');
    if (
      !(proposal.author === currentUser.id && acl.isAllowed('proposal', 'update-own')) &&
      !acl.isAllowed('proposal', 'update')
    ) {
      throw new ForbiddenError('FORBIDDEN');
    }

    const { title, description, status, plannedAt, releasedAt } = input;
    if (status !== undefined && !acl.isAllowed('proposal', 'update')) {
      throw new ForbiddenError('FORBIDDEN');
    }
    const updated = await proposalService.update({
      ...proposal,
      title: typeof title === 'string' ? title : proposal.title,
      description: typeof description === 'string' ? description : proposal.description,
      status: (typeof status === 'string' ? status : proposal.status) as Status,
      plannedAt: plannedAt instanceof Date ? plannedAt : proposal.plannedAt,
      releasedAt: releasedAt instanceof Date ? releasedAt : proposal.releasedAt,
    });

    return updated;
  },
};

export const ProposalDeleteMutation: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(GraphQLBoolean),
  args: {
    id: {
      type: GraphQLNonNull(UuidType),
    },
  },
  resolve: onlyAllowed('proposal.delete', async (root, { id }, { currentUser }) => {
    if (!currentUser) throw new AuthenticationError('UNAUTHENTICATED');

    const proposalService = container.model.proposalService();
    const proposal = await proposalService.proposalTable().where('id', id).first();
    if (!proposal) throw new UserInputError('Proposal not found');

    await proposalService.delete(proposal);

    return true;
  }),
};
