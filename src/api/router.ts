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
import { AuthEthereumMutation, UserType } from './schema/user';
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
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          authEth: AuthEthereumMutation,
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
        },
      }),
    }),
    subscriptions: '/api',
    playground: true,
    context: ({ req }) => req,
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
      .where('id', req.params.webHookId);

    if (!webHook) {
      res.sendStatus(404);
      return;
    }

    await container.model.queueService().push('processEventWebHook', {
      eventName: req.body.eventName,
      events: req.body.events,
      contract: req.body.contract,
      webHookId: req.params.webHookId,
    });

    res.sendStatus(200);
  });
}
