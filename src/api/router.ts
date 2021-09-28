import { Express, Request } from 'express';
import { Server } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { json } from 'body-parser';
import { GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import {
  UserContactEmailConfirmMutation,
  UserContactCreateMutation,
  UserContactDeleteMutation,
  UserContactListQuery,
  UserContactQuery,
  UserEventSubscriptionQuery,
  UserEventSubscriptionListQuery,
  UserEventSubscriptionCreateMutation,
  UserEventSubscriptionDeleteMutation,
} from '@api/schema/notification';
import container from '@container';
import {
  AddWalletMutation,
  AuthEthereumMutation,
  AuthWavesMutation,
  UserType,
} from './schema/user';
import * as middlewares from './middlewares';
import {
  ProtocolCreateMutation,
  ProtocolDeleteMutation,
  ProtocolListQuery,
  ProtocolQuery,
  ProtocolUpdateMutation,
  ContractCreateMutation,
  ContractUpdateMutation,
  ContractDeleteMutation,
  ContractWalletLinkMutation,
  ContractWalletUnlinkMutation,
} from './schema/protocol';
import {
  ProposalCreateMutation,
  ProposalDeleteMutation,
  ProposalListQuery,
  ProposalQuery,
  ProposalUpdateMutation,
  UnvoteMutation,
  VoteMutation,
} from './schema/proposal';
import { TokenAliasListQuery, TokenAliasQuery, TokenListQuery } from './schema/token';
import {
  ProductCreateMutation,
  ProductDeleteMutation,
  ProductListQuery,
  ProductUpdateMutation,
} from './schema/store';
import {
  GovProposalListQuery,
  GovProposalQuery,
  GovReceiptQuery,
  GovTokenQuery,
  GovVotesQuery,
} from './schema/governance';
import * as Automate from './schema/automate';
import { RestakeStrategyQuery } from './schema/restakeStrategy';

export function route({ express, server }: { express: Express; server: Server }) {
  const apollo = new ApolloServer({
    schema: new GraphQLSchema({
      query: new GraphQLObjectType<undefined, Request>({
        name: 'Query',
        fields: {
          ping: {
            type: GraphQLNonNull(GraphQLString),
            resolve: () => 'pong',
          },
          me: {
            type: UserType,
            resolve: (root, args, { currentUser }) => currentUser,
          },
          protocol: ProtocolQuery,
          protocols: ProtocolListQuery,
          proposal: ProposalQuery,
          proposals: ProposalListQuery,
          userContact: UserContactQuery,
          userContacts: UserContactListQuery,
          userEventSubscription: UserEventSubscriptionQuery,
          userEventSubscriptions: UserEventSubscriptionListQuery,
          tokens: TokenListQuery,
          tokenAlias: TokenAliasQuery,
          tokensAlias: TokenAliasListQuery,
          products: ProductListQuery,
          govProposal: GovProposalQuery,
          govProposals: GovProposalListQuery,
          govReceipt: GovReceiptQuery,
          govVotes: GovVotesQuery,
          automateTrigger: Automate.TriggerQuery,
          automateTriggers: Automate.TriggerListQuery,
          automateContracts: Automate.ContractListQuery,
          govToken: GovTokenQuery,
          restakeStrategy: RestakeStrategyQuery,
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          authEth: AuthEthereumMutation,
          authWaves: AuthWavesMutation,
          addWallet: AddWalletMutation,
          protocolCreate: ProtocolCreateMutation,
          protocolUpdate: ProtocolUpdateMutation,
          protocolDelete: ProtocolDeleteMutation,
          contractCreate: ContractCreateMutation,
          contractUpdate: ContractUpdateMutation,
          contractDelete: ContractDeleteMutation,
          contractWalletLink: ContractWalletLinkMutation,
          contractWalletUnlink: ContractWalletUnlinkMutation,
          proposalCreate: ProposalCreateMutation,
          proposalUpdate: ProposalUpdateMutation,
          proposalDelete: ProposalDeleteMutation,
          vote: VoteMutation,
          unvote: UnvoteMutation,
          userContactCreate: UserContactCreateMutation,
          userContactEmailConfirm: UserContactEmailConfirmMutation,
          userContactDelete: UserContactDeleteMutation,
          userEventSubscriptionCreate: UserEventSubscriptionCreateMutation,
          userEventSubscriptionDelete: UserEventSubscriptionDeleteMutation,
          productCreate: ProductCreateMutation,
          productUpdate: ProductUpdateMutation,
          productDelete: ProductDeleteMutation,
          automateTriggerCreate: Automate.TriggerCreateMutation,
          automateTriggerUpdate: Automate.TriggerUpdateMutation,
          automateTriggerDelete: Automate.TriggerDeleteMutation,
          automateConditionCreate: Automate.ConditionCreateMutation,
          automateConditionUpdate: Automate.ConditionUpdateMutation,
          automateConditionDelete: Automate.ConditionDeleteMutation,
          automateActionCreate: Automate.ActionCreateMutation,
          automateActionUpdate: Automate.ActionUpdateMutation,
          automateActionDelete: Automate.ActionDeleteMutation,
          automateContractCreate: Automate.ContractCreateMutation,
          automateContractUpdate: Automate.ContractUpdateMutation,
          automateContractDelete: Automate.ContractDeleteMutation,
        },
      }),
    }),
    subscriptions: '/api',
    playground: true,
    context: ({ req }) => req,
    formatError: (err) => {
      container.logger().error(err.toString());
      return err;
    },
  });
  apollo.installSubscriptionHandlers(server);
  express.use('/api', [
    json(),
    middlewares.currentUser,
    middlewares.i18n,
    middlewares.acl,
    apollo.getMiddleware({ path: '/' }),
  ]);

  express.route('/callback/event/:webHookId').post(json(), async (req, res) => {
    const { secret } = req.query;
    if (secret !== container.parent.api.secret) {
      res.sendStatus(403);
      return;
    }

    const webHook = await container.model
      .contractEventWebHookTable()
      .where('id', req.params.webHookId)
      .first();

    if (!webHook) {
      res.sendStatus(404);
      return;
    }

    const eventQueueParam = {
      eventName: req.body.eventName,
      events: req.body.events,
      webHookId: req.params.webHookId,
    };

    await container.model.queueService().push('sendEventsNotifications', eventQueueParam);
    await container.model.queueService().push('linkContractsFromEvents', eventQueueParam);

    res.sendStatus(200);
  });
  express.route('/callback/trigger/:triggerId').post(json(), async (req, res) => {
    const { secret } = req.query;
    if (secret !== container.parent.api.secret) return res.sendStatus(403);

    await container.model.queueService().push('automateTriggerRun', { id: req.params.triggerId });

    return res.sendStatus(200);
  });
}
