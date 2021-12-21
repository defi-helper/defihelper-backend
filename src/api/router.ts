import container from '@container';
import { Express, Request } from 'express';
import { Server } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { json } from 'body-parser';
import { GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import * as middlewares from '@api/middlewares';
import * as notificationSchemas from '@api/schema/notification';
import * as userNotificationSchemas from '@api/schema/userNotification';
import * as billingSchemas from '@api/schema/billing';
import * as userSchemas from '@api/schema/user';
import * as protocolSchemas from '@api/schema/protocol';
import * as proposalSchemas from '@api/schema/proposal';
import * as tokenSchemas from '@api/schema/token';
import * as storeSchemas from '@api/schema/store';
import * as governanceSchemas from '@api/schema/governance';
import * as Automate from '@api/schema/automate';
import * as restakeStrategySchemas from '@api/schema/restakeStrategy';
import * as treasurySchemas from '@api/schema/treasury';

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
            type: userSchemas.UserType,
            resolve: (root, args, { currentUser }) => currentUser,
          },
          users: userSchemas.UserListQuery,
          protocol: protocolSchemas.ProtocolQuery,
          protocols: protocolSchemas.ProtocolListQuery,
          proposal: proposalSchemas.ProposalQuery,
          proposals: proposalSchemas.ProposalListQuery,
          userContact: notificationSchemas.UserContactQuery,
          userContacts: notificationSchemas.UserContactListQuery,
          userNotifications: userNotificationSchemas.UserNotificationListQuery,
          userEventSubscription: notificationSchemas.UserEventSubscriptionQuery,
          userEventSubscriptions: notificationSchemas.UserEventSubscriptionListQuery,
          tokens: tokenSchemas.TokenListQuery,
          tokenAlias: tokenSchemas.TokenAliasQuery,
          tokensAlias: tokenSchemas.TokenAliasListQuery,
          products: storeSchemas.ProductListQuery,
          govProposal: governanceSchemas.GovProposalQuery,
          govProposals: governanceSchemas.GovProposalListQuery,
          govReceipt: governanceSchemas.GovReceiptQuery,
          govVotes: governanceSchemas.GovVotesQuery,
          automateDescription: Automate.DescriptionQuery,
          automateTrigger: Automate.TriggerQuery,
          automateTriggers: Automate.TriggerListQuery,
          automateContracts: Automate.ContractListQuery,
          govToken: governanceSchemas.GovTokenQuery,
          restakeStrategy: restakeStrategySchemas.RestakeStrategyQuery,
          treasury: treasurySchemas.TreasuryQuery,
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          authEth: userSchemas.AuthEthereumMutation,
          authWaves: userSchemas.AuthWavesMutation,
          addWallet: userSchemas.AddWalletMutation,
          walletUpdate: userSchemas.WalletUpdateMutation,
          walletDelete: userSchemas.WalletDeleteMutation,
          userUpdate: userSchemas.UserUpdateMutation,
          protocolCreate: protocolSchemas.ProtocolCreateMutation,
          protocolUpdate: protocolSchemas.ProtocolUpdateMutation,
          protocolResolveContracts: protocolSchemas.ProtocolResolveContractsMutation,
          protocolDelete: protocolSchemas.ProtocolDeleteMutation,
          protocolFavorite: protocolSchemas.ProtocolFavoriteMutation,
          contractCreate: protocolSchemas.ContractCreateMutation,
          contractUpdate: protocolSchemas.ContractUpdateMutation,
          contractDelete: protocolSchemas.ContractDeleteMutation,
          contractWalletLink: protocolSchemas.ContractWalletLinkMutation,
          contractWalletUnlink: protocolSchemas.ContractWalletUnlinkMutation,
          userNotificationToggle: userNotificationSchemas.UserNotificationToggleMutation,
          tokenUpdate: tokenSchemas.TokenUpdateMutation,
          tokenAliasCreate: tokenSchemas.TokenAliasCreateMutation,
          tokenAliasUpdate: tokenSchemas.TokenAliasUpdateMutation,
          tokenAliasDelete: tokenSchemas.TokenAliasDeleteMutation,
          proposalCreate: proposalSchemas.ProposalCreateMutation,
          proposalUpdate: proposalSchemas.ProposalUpdateMutation,
          proposalDelete: proposalSchemas.ProposalDeleteMutation,
          vote: proposalSchemas.VoteMutation,
          unvote: proposalSchemas.UnvoteMutation,
          userContactCreate: notificationSchemas.UserContactCreateMutation,
          userContactUpdate: notificationSchemas.UserContactUpdateMutation,
          userContactEmailConfirm: notificationSchemas.UserContactEmailConfirmMutation,
          userContactDelete: notificationSchemas.UserContactDeleteMutation,
          userEventSubscriptionCreate: notificationSchemas.UserEventSubscriptionCreateMutation,
          userEventSubscriptionDelete: notificationSchemas.UserEventSubscriptionDeleteMutation,
          productCreate: storeSchemas.ProductCreateMutation,
          productUpdate: storeSchemas.ProductUpdateMutation,
          productDelete: storeSchemas.ProductDeleteMutation,
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
      subscription: new GraphQLObjectType<any, Request>({
        name: 'Subscription',
        fields: {
          onWalletMetricUpdated: userSchemas.OnWalletMetricUpdated,
          onBillingTransferCreated: billingSchemas.OnTransferCreated,
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
    middlewares.dataLoader,
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
