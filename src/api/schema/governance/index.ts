import container from '@container';
import { Request } from 'express';
import { Proposal, ProposalState, Receipt, ReceiptSupport } from '@models/Governance/Entity';
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
import { GovernanceService } from '@models/Governance/Service';
import { PaginateList, PaginationArgument, SortArgument } from '../types';
import { ProposalType } from '../proposal';

export const GovProposalStateEnum = new GraphQLEnumType({
  name: 'GovProposalStateEnum',
  values: {
    [ProposalState.Pending]: {},
    [ProposalState.Active]: {},
    [ProposalState.Canceled]: {},
    [ProposalState.Defeated]: {},
    [ProposalState.Succeeded]: {},
    [ProposalState.Queued]: {},
    [ProposalState.Expired]: {},
    [ProposalState.Executed]: {},
  },
});

export const GovProposalType = new GraphQLObjectType<Proposal>({
  name: 'GovProposalType',
  fields: {
    id: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Identificator',
    },
    proposer: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Proposer',
    },
    eta: {
      type: GraphQLNonNull(GraphQLInt),
      description:
        'The timesamp that the protposal will be available for execution, set once the vote succeeds',
    },
    targets: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
      description: 'Target addresses for calls',
      resolve: ({ calldata }) => calldata.targets,
    },
    values: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
      description: 'List of values to be passed to the calls',
      resolve: ({ calldata }) => calldata.values,
    },
    signatures: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))),
      description: 'List of function signatures to be calls',
      resolve: ({ calldata }) => calldata.signatures,
    },
    calldatas: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLString))))),
      description: 'List of calldata to be passed to each call',
      resolve: ({ calldata }) => calldata.args,
    },
    startBlock: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'Start block of vote',
    },
    endBlock: {
      type: GraphQLNonNull(GraphQLInt),
      description: 'End block of vote',
    },
    forVotes: {
      type: GraphQLNonNull(GraphQLString),
      description: 'For votes',
    },
    againstVotes: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Against votes',
    },
    abstainVotes: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Abstain votes',
    },
    canceled: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is canceled',
    },
    executed: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Is executed',
    },
    state: {
      type: GraphQLNonNull(GovProposalStateEnum),
      description: 'Current state',
    },
    description: {
      type: GraphQLNonNull(GraphQLString),
      description: 'Description',
    },
  },
});

export const GovReceiptSupportEnum = new GraphQLEnumType({
  name: 'GovReceiptSupportEnum',
  values: {
    [ReceiptSupport.Against]: {},
    [ReceiptSupport.For]: {},
    [ReceiptSupport.Abstain]: {},
  },
});

export const GovReceiptType = new GraphQLObjectType<Receipt>({
  name: 'GovReceiptType',
  fields: {
    hasVoted: {
      type: GraphQLNonNull(GraphQLBoolean),
      description: 'Whether or not a vote has been cast',
    },
    support: {
      type: GraphQLNonNull(GovReceiptSupportEnum),
      description: 'Whether or not the voter supports the proposal or abstains',
    },
    votes: {
      type: GraphQLNonNull(GraphQLString),
      description: 'The number of votes the voter had, which were cast',
    },
    reason: {
      type: GraphQLNonNull(GraphQLString),
      description: 'The reason given for the vote by the voter',
    },
  },
});

export const GovProposalQuery: GraphQLFieldConfig<any, Request> = {
  type: GovProposalType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'GovProposalFilterInputType',
          fields: {
            network: {
              type: GraphQLNonNull(GraphQLString),
            },
            contract: {
              type: GraphQLNonNull(GraphQLString),
            },
            proposalId: {
              type: GraphQLNonNull(GraphQLInt),
            },
            cache: {
              type: GraphQLNonNull(GraphQLBoolean),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }) => {
    const { network, contract, proposalId, cache } = filter;
    return container.model
      .governanceService()
      .getProposal(network, contract, proposalId, { cache });
  },
};

export const GovProposalListQuery: GraphQLFieldConfig<any, Request> = {
  type: GraphQLNonNull(PaginateList('GovProposalListQuery', GraphQLNonNull(ProposalType))),
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'GovProposalListFilterInputType',
          fields: {
            network: {
              type: GraphQLNonNull(GraphQLString),
            },
            contract: {
              type: GraphQLNonNull(GraphQLString),
            },
            cache: {
              type: GraphQLNonNull(GraphQLBoolean),
            },
          },
        }),
      ),
    },
    sort: SortArgument('GovProposalListSortInputType', ['id'], [{ column: 'id', order: 'desc' }]),
    pagination: PaginationArgument('GovProposalListPaginationInputType'),
  },
  resolve: async (root, { filter, sort, pagination }) => {
    const latestProposalId = await GovernanceService.latestProposalId(
      filter.network,
      filter.contract,
    );
    const allIds = Array.from(new Array(latestProposalId).keys());
    if (sort.order === 'asc') {
      allIds.reverse();
    }
    const ids = allIds.slice(pagination.offset, pagination.offset + pagination.limit);
    const governanceService = container.model.governanceService();

    return {
      list: await Promise.all(
        ids.map((id) =>
          governanceService.getProposal(filter.network, filter.contract, id + 1, {
            cache: filter.cache,
          }),
        ),
      ),
      pagination: {
        count: { count: latestProposalId },
      },
    };
  },
};

export const GovReceiptQuery: GraphQLFieldConfig<any, Request> = {
  type: GovReceiptType,
  args: {
    filter: {
      type: GraphQLNonNull(
        new GraphQLInputObjectType({
          name: 'GovReceiptFilterInputType',
          fields: {
            network: {
              type: GraphQLNonNull(GraphQLInt),
            },
            contract: {
              type: GraphQLNonNull(GraphQLString),
            },
            proposalId: {
              type: GraphQLNonNull(GraphQLInt),
            },
            wallet: {
              type: GraphQLNonNull(GraphQLString),
            },
            cache: {
              type: GraphQLNonNull(GraphQLBoolean),
            },
          },
        }),
      ),
    },
  },
  resolve: async (root, { filter }) => {
    const { network, contract, proposalId, wallet, cache } = filter;
    return container.model
      .governanceService()
      .getReceipt(network, contract, proposalId, wallet, { cache });
  },
};
