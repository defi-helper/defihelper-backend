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
import Jimp from 'jimp';
import { metricContractTableName } from '@models/Metric/Entity';
import { contractTableName } from '@models/Protocol/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import BN from 'bignumber.js';
import { Blockchain } from '@models/types';

interface AprMetric {
  contract: string;
  apr: number;
  blockchain: Blockchain;
  network: string;
}

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
          walletMetricScan: userSchemas.WalletMetricScanMutation,
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
          billingTransferCreate: billingSchemas.AddTransferMutation,
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
          onTokenMetricUpdated: userSchemas.OnTokenMetricUpdated,
          onBillingTransferCreated: billingSchemas.OnTransferCreated,
          onBillingTransferUpdated: billingSchemas.OnTransferUpdated,
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
  express.route('/protocol/opengraph-preview/:protocolId').get(async (req, res) => {
    const { protocolId } = req.params;
    const protocol = await container.model.protocolTable().where('id', protocolId).first();

    if (!protocol) {
      return res.status(503).send('protocol not found');
    }

    const maxLogoWidth = 450;
    const maxLogoHeight = 450;

    const database = container.database();
    const aprMetrics: AprMetric[] = await container.model
      .metricContractTable()
      .distinctOn(`${metricContractTableName}.contract`)
      .column(`${contractTableName}.blockchain`)
      .column(`${contractTableName}.network`)
      .column(`${metricContractTableName}.contract`)
      .column(database.raw(`(${metricContractTableName}.data->>'aprYear')::numeric AS apr`))
      .innerJoin(
        contractTableName,
        `${contractTableName}.id`,
        `${metricContractTableName}.contract`,
      )
      .where(`${contractTableName}.protocol`, protocol.id)
      .andWhere(database.raw(`${metricContractTableName}.data->>'aprYear' IS NOT NULL`))
      .orderBy(`${metricContractTableName}.contract`)
      .orderBy(`${metricContractTableName}.date`, 'DESC');

    const calculatedApyList = await Promise.all(
      aprMetrics.map(async (apr) => {
        const boost = await apyBoost(
          apr.blockchain,
          apr.network,
          10000,
          new BN(apr.apr).toNumber(),
        );

        const actualBoost = new BN(boost).minus(apr.apr).toNumber();

        return {
          initial: new BN(apr.apr).toNumber(),
          boosted: actualBoost > 0 ? actualBoost : 0,
        };
      }),
    );

    const avgInitialApy = Math.round(
      (calculatedApyList.reduce((prev, curr) => new BN(prev).plus(curr.initial).toNumber(), 0) /
        calculatedApyList.length) *
        100,
    );

    const avgBoostedApy = Math.round(
      (calculatedApyList.reduce((prev, curr) => new BN(prev).plus(curr.boosted).toNumber(), 0) /
        calculatedApyList.length) *
        100,
    );

    const [
      templateInstance,
      protocolLogoInstance,
      withoutDfhFont,
      withDfhBoostedFont,
      totalApyFont,
      protocolNameFont,
    ] = await Promise.all([
      Jimp.read(`${__dirname}/../assets/opengraph-template.png`),
      protocol.previewPicture ? Jimp.read(protocol.previewPicture) : null,
      Jimp.loadFont(`${__dirname}/../assets/font-without-dfh/FCK4eZkmzDMwvOVkx7MoTdys.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-with-dfh/KDHm2vWUrEv1xTEC3ilBxVL2.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-total-apy/QHPbZ5kKUxcehQ40MdnPZLK9.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-protocol-name/kkMJaED6sIZbo4N0PfpUSPXk.ttf.fnt`),
    ]);

    // protocolss apy
    await templateInstance.print(
      withoutDfhFont,
      117,
      175,
      `APY ${avgInitialApy > 10000 ? '>10000' : avgInitialApy.toFixed()}%`,
    );

    // boosted apy
    await templateInstance.print(
      withDfhBoostedFont,
      117,
      380,
      `APY ${avgBoostedApy > 10000 ? '>10000' : avgBoostedApy.toFixed()}%`,
    );

    // total apy
    await templateInstance.print(
      totalApyFont,
      117,
      660,
      `${
        avgBoostedApy + avgInitialApy > 10000 ? '>10000' : (avgBoostedApy + avgInitialApy).toFixed()
      }%`,
    );

    // protocol name
    await templateInstance.print(protocolNameFont, 117, 114, protocol.name);

    // protocol logo
    if (protocolLogoInstance) {
      protocolLogoInstance.resize(maxLogoWidth, Jimp.AUTO);
      if (protocolLogoInstance.getHeight() > maxLogoHeight) {
        protocolLogoInstance.resize(Jimp.AUTO, maxLogoHeight);
      }

      const actualLogoWidth = protocolLogoInstance.getWidth();
      await templateInstance.composite(
        protocolLogoInstance,
        templateInstance.getWidth() - actualLogoWidth / 2 - 415,
        templateInstance.getHeight() / 2 - protocolLogoInstance.getHeight() / 2,
      );
    }

    return res
      .writeHead(200, {
        'Content-Type': 'image/png',
      })
      .end(await templateInstance.getBufferAsync(Jimp.MIME_PNG));
  });
}
