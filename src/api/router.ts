import container from '@container';
import { Express, Request } from 'express';
import { Server } from 'http';
import { ApolloServer } from 'apollo-server-express';
import { formatApolloErrors } from 'apollo-server-errors';
import { json } from 'body-parser';
import cors from 'cors';
import { GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { DataLoaderContainer } from '@api/dataLoader/container';
import * as middlewares from '@api/middlewares';
import * as configSchemas from '@api/schema/config';
import * as notificationSchemas from '@api/schema/notification';
import * as userNotificationSchemas from '@api/schema/userNotification';
import * as billingSchemas from '@api/schema/billing';
import * as userSchemas from '@api/schema/user';
import * as protocolSchemas from '@api/schema/protocol';
import * as proposalSchemas from '@api/schema/proposal';
import * as tokenSchemas from '@api/schema/token';
import * as storeSchemas from '@api/schema/store';
import * as governanceSchemas from '@api/schema/governance';
import * as automateSchemas from '@api/schema/automate';
import * as restakeStrategySchemas from '@api/schema/restakeStrategy';
import * as treasurySchemas from '@api/schema/treasury';
import * as monitoringSchemas from '@api/schema/monitoring';
import * as landingSchemas from '@api/schema/landing';
import * as tradingSchemas from '@api/schema/trading';
import * as smartTradeSchemas from '@api/schema/smartTrade';
import * as tagSchemas from '@api/schema/tag';
import Jimp from 'jimp';
import { metricContractTableName } from '@models/Metric/Entity';
import {
  contractBlockchainTableName,
  contractTableName,
  MetadataType,
} from '@models/Protocol/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import BN from 'bignumber.js';
import { Blockchain } from '@models/types';
import { triggerTableName } from '@models/Automate/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { Token } from '@models/Token/Entity';

import axios from 'axios';

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
          config: configSchemas.ConfigQuery,
          me: userSchemas.MeQuery,
          userReferrer: userSchemas.UserReferrerCodeQuery,
          users: userSchemas.UserListQuery,
          protocol: protocolSchemas.ProtocolQuery,
          protocols: protocolSchemas.ProtocolListQuery,
          userProtocols: protocolSchemas.UserProtocolListQuery,
          contracts: protocolSchemas.ContractListQuery,
          proposal: proposalSchemas.ProposalQuery,
          proposals: proposalSchemas.ProposalListQuery,
          landingMediumPosts: landingSchemas.LandingMediumPostsQuery,
          userContact: notificationSchemas.UserContactQuery,
          userContacts: notificationSchemas.UserContactListQuery,
          userNotifications: userNotificationSchemas.UserNotificationListQuery,
          tokens: tokenSchemas.TokenListQuery,
          tokenAlias: tokenSchemas.TokenAliasQuery,
          tokensAlias: tokenSchemas.TokenAliasListQuery,
          products: storeSchemas.ProductListQuery,
          productPriceFeed: storeSchemas.ProductPriceFeedQuery,
          billingBalance: billingSchemas.BalanceMetaQuery,
          govProposal: governanceSchemas.GovProposalQuery,
          govProposals: governanceSchemas.GovProposalListQuery,
          govReceipt: governanceSchemas.GovReceiptQuery,
          govVotes: governanceSchemas.GovVotesQuery,
          automateDescription: automateSchemas.DescriptionQuery,
          automateTrigger: automateSchemas.TriggerQuery,
          automateTriggers: automateSchemas.TriggerListQuery,
          automateContracts: automateSchemas.ContractListQuery,
          govToken: governanceSchemas.GovTokenQuery,
          restakeStrategy: restakeStrategySchemas.RestakeStrategyQuery,
          restakeCalculator: restakeStrategySchemas.RestakeCalculatorQuery,
          treasury: treasurySchemas.TreasuryQuery,
          monitoringUsersRegisteringHistory:
            monitoringSchemas.MonitoringUsersRegisteringHistoryQuery,
          monitoringWalletsRegisteringHistory:
            monitoringSchemas.MonitoringWalletRegisteringHistoryQuery,
          monitoringAutomateRunHistory: monitoringSchemas.MonitoringAutomateRunHistoryQuery,
          monitoringAutomatesCreationHistory:
            monitoringSchemas.MonitoringAutomatesCreationHistoryQuery,
          monitoringAutoRestakeAutomatesCreationHistory:
            monitoringSchemas.MonitoringAutoRestakeAutomatesCreationHistoryQuery,
          monitoringProtocolEarningsHistory:
            monitoringSchemas.MonitoringProtocolEarningsHistoryQuery,
          monitoringTelegramContactsHistory: monitoringSchemas.MonitoringTelegramContactsQuery,
          smartTradeOrders: smartTradeSchemas.OrderListQuery,
          tags: tagSchemas.TagsListQuery,
        },
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          userUpdate: userSchemas.UserUpdateMutation,
          authThroughAdmin: userSchemas.AuthThroughAdminMutation,
          authEth: userSchemas.AuthEthereumMutation,
          authDemo: userSchemas.AuthDemoMutation,
          authWaves: userSchemas.AuthWavesMutation,
          addWallet: userSchemas.AddWalletMutation,
          walletUpdate: userSchemas.WalletUpdateMutation,
          walletDelete: userSchemas.WalletDeleteMutation,
          walletUpdateStatistics: userSchemas.WalletUpdateStatisticsMutation,
          walletMetricScan: userSchemas.WalletMetricScanMutation,
          integrationExchangeApiConnect: userSchemas.IntegrationExchangeApiConnectMutation,
          integrationDisconnect: userSchemas.IntegrationDisconnectMutation,
          protocolCreate: protocolSchemas.ProtocolCreateMutation,
          protocolUpdate: protocolSchemas.ProtocolUpdateMutation,
          protocolResolveContracts: protocolSchemas.ProtocolResolveContractsMutation,
          contractScannerRegister: protocolSchemas.ContractScannerRegisterMutation,
          protocolDelete: protocolSchemas.ProtocolDeleteMutation,
          protocolFavorite: protocolSchemas.ProtocolFavoriteMutation,
          contractCreate: protocolSchemas.ContractCreateMutation,
          contractUpdate: protocolSchemas.ContractUpdateMutation,
          contractDelete: protocolSchemas.ContractDeleteMutation,
          contractWalletLink: protocolSchemas.ContractWalletLinkMutation,
          contractWalletUnlink: protocolSchemas.ContractWalletUnlinkMutation,
          contractUserLink: protocolSchemas.ContractUserLinkMutation,
          contractUserUnlink: protocolSchemas.ContractUserUnlinkMutation,
          contractMetricScan: protocolSchemas.ContractMetricsScanMutation,
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
          proposalTag: proposalSchemas.TagMutation,
          proposalUntag: proposalSchemas.UntagMutation,
          userContactCreate: notificationSchemas.UserContactCreateMutation,
          userContactUpdate: notificationSchemas.UserContactUpdateMutation,
          userContactEmailConfirm: notificationSchemas.UserContactEmailConfirmMutation,
          userContactDelete: notificationSchemas.UserContactDeleteMutation,
          productCreate: storeSchemas.ProductCreateMutation,
          productUpdate: storeSchemas.ProductUpdateMutation,
          productDelete: storeSchemas.ProductDeleteMutation,
          billingTransferCreate: billingSchemas.AddTransferMutation,
          zapFeePayCreate: billingSchemas.ZAPFeePayCreateMutation,
          automateTriggerCreate: automateSchemas.TriggerCreateMutation,
          automateTriggerUpdate: automateSchemas.TriggerUpdateMutation,
          automateTriggerDelete: automateSchemas.TriggerDeleteMutation,
          automateConditionCreate: automateSchemas.ConditionCreateMutation,
          automateConditionUpdate: automateSchemas.ConditionUpdateMutation,
          automateConditionDelete: automateSchemas.ConditionDeleteMutation,
          automateActionCreate: automateSchemas.ActionCreateMutation,
          automateActionUpdate: automateSchemas.ActionUpdateMutation,
          automateActionDelete: automateSchemas.ActionDeleteMutation,
          automateContractCreate: automateSchemas.ContractCreateMutation,
          automateContractUpdate: automateSchemas.ContractUpdateMutation,
          automateContractDelete: automateSchemas.ContractDeleteMutation,
          automateContractStopLossEnable: automateSchemas.ContractStopLossEnable,
          automateContractStopLossDisable: automateSchemas.ContractStopLossDisable,
          automateInvestCreate: automateSchemas.InvestCreateMutation,
          automateInvestRefund: automateSchemas.InvestRefundMutation,
          automateContractTriggerUpdate: automateSchemas.ContractTriggerUpdateMutation,
          tradingAuth: tradingSchemas.TradingAuthMutation,
          smartTradeCancel: smartTradeSchemas.OrderCancelMutation,
          smartTradeClaim: smartTradeSchemas.OrderClaimMutation,
          smartTradeSwapOrderCreate: smartTradeSchemas.SwapOrderCreateMutation,
          smartTradeSwapOrderUpdate: smartTradeSchemas.SwapOrderUpdateMutation,
        },
      }),
      subscription: new GraphQLObjectType<any, Request>({
        name: 'Subscription',
        fields: {
          onWalletCreated: userSchemas.OnWalletCreated,
          onWalletMetricUpdated: userSchemas.OnWalletMetricUpdated,
          onTokenMetricUpdated: userSchemas.OnTokenMetricUpdated,
          onBillingTransferCreated: billingSchemas.OnTransferCreated,
          onBillingTransferUpdated: billingSchemas.OnTransferUpdated,
          onUserContactActivated: notificationSchemas.OnUserContactActivated,
          onSmartTradeOrderUpdated: smartTradeSchemas.OnOrderUpdated,
        },
      }),
    }),
    subscriptions: '/api',
    playground: true,
    introspection: true,
    context: ({ req, connection }) => {
      if (req) {
        return req;
      }
      if (connection) {
        return {
          dataLoader: new DataLoaderContainer({}),
        };
      }
      return {};
    },
    formatError: (err) => {
      container.model
        .logService()
        .create(
          `graphql:${err.extensions?.code ?? 'UNKNOWN'}`,
          JSON.stringify(formatApolloErrors([err]), null, 4),
        );
      container.logger().error(`${err}`);
      return err;
    },
    plugins: [
      {
        requestDidStart() {
          return {
            didEncounterErrors(context) {
              const error = `query: ${context.request.query?.toString()}
                  variables: ${JSON.stringify(context.request.variables, null, 4)}`;
              container.model.logService().create(`graphql:PARSING_ERROR`, error);
              container.logger().error(error);
            },
            executionDidStart(context) {
              const execStartTime = Date.now();
              return {
                executionDidEnd() {
                  container
                    .logger()
                    .debug(
                      `"${context.request.operationName}" execute time: ${
                        Date.now() - execStartTime
                      }ms`,
                    );
                },
              };
            },
          };
        },
      },
    ],
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

  express.use(cors({ origin: container.parent.adapters.host }));
  express.route('/p/:code').get(async (req, res) => {
    const { code } = req.params;
    const codeRecord = await container.model.referrerCodeTable().where({ code }).first();
    if (!codeRecord) {
      return res.redirect('https://app.defihelper.io');
    }

    return res
      .cookie('dfh-parent-code', codeRecord.id, {
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
        domain: 'defihelper.io',
      })
      .redirect(codeRecord.redirectTo);
  });
  express.route('/callback/trigger/:triggerId').post(json(), async (req, res) => {
    const { secret } = req.query;
    if (secret !== container.parent.api.secret) return res.sendStatus(403);

    const trigger = await container.model
      .automateTriggerTable()
      .columns(`${triggerTableName}.*`)
      .innerJoin(walletTableName, `${walletTableName}.id`, `${triggerTableName}.wallet`)
      .andWhere(`${triggerTableName}.id`, req.params.triggerId)
      .whereNull(`${walletTableName}.suspendReason`)
      .andWhere(`${triggerTableName}.active`, true)
      .first();
    if (trigger) {
      await container.model
        .queueService()
        .push('automateTriggerRun', { id: trigger.id }, { topic: 'trigger' });
    }

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
      .column(`${contractBlockchainTableName}.blockchain`)
      .column(`${contractBlockchainTableName}.network`)
      .column(`${metricContractTableName}.contract`)
      .column(database.raw(`(${metricContractTableName}.data->>'aprYear')::numeric AS apr`))
      .innerJoin(
        contractTableName,
        `${contractTableName}.id`,
        `${metricContractTableName}.contract`,
      )
      .innerJoin(
        contractBlockchainTableName,
        `${contractTableName}.id`,
        `${contractBlockchainTableName}.id`,
      )
      .where(`${contractTableName}.protocol`, protocol.id)
      .andWhere(`${contractTableName}.hidden`, false)
      .andWhere(`${contractTableName}.deprecated`, false)
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

        const actualBoost = new BN(boost).multipliedBy(100).minus(apr.apr).toNumber();

        return {
          initial: new BN(apr.apr).toNumber(),
          boosted: actualBoost > 0 ? actualBoost : 0,
        };
      }),
    );

    const isDebank = protocol.adapter === 'debankByApiReadonly';
    const maxInitialApy = Math.round(Math.max(...calculatedApyList.map((v) => v.initial)) * 100);
    const maxBoostedApy = Math.round(
      Math.max(...calculatedApyList.map((v) => v.boosted)) + maxInitialApy,
    );

    try {
      if (protocol.previewPicture) {
        await Jimp.read(protocol.previewPicture);
      }
    } catch {
      return res.status(503).send('picture must be in png');
    }

    const [
      templateInstance,
      protocolLogoInstance,
      withoutDfhFont,
      withDfhBoostedFont,
      totalApyFont,
      protocolNameFont,
    ] = await Promise.all([
      Jimp.read(
        `${__dirname}/../assets/opengraph-${isDebank ? 'readonly-template' : 'template'}.png`,
      ),
      protocol.previewPicture ? Jimp.read(protocol.previewPicture) : null,
      Jimp.loadFont(`${__dirname}/../assets/font-without-dfh/FCK4eZkmzDMwvOVkx7MoTdys.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-with-dfh/KDHm2vWUrEv1xTEC3ilBxVL2.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-total-apy/QHPbZ5kKUxcehQ40MdnPZLK9.ttf.fnt`),
      Jimp.loadFont(`${__dirname}/../assets/font-protocol-name/kkMJaED6sIZbo4N0PfpUSPXk.ttf.fnt`),
    ]);

    if (isDebank) {
      await Promise.all(
        protocol.name
          .split(' ')
          .map(async (word, i) => templateInstance.print(totalApyFont, 117, 170 + i * 135, word)),
      );
    }

    if (!isDebank) {
      // protocol's apy
      await templateInstance.print(
        withoutDfhFont,
        117,
        175,
        `APY ${maxInitialApy > 10000 ? '>10000' : maxInitialApy.toFixed()}%`,
      );

      // boosted apy
      await templateInstance.print(
        withDfhBoostedFont,
        117,
        380,
        `APY ${maxBoostedApy > 10000 ? '>10000' : maxBoostedApy.toFixed()}%`,
      );

      // total apy
      await templateInstance.print(
        totalApyFont,
        117,
        660,
        `${
          maxBoostedApy + maxInitialApy > 10000
            ? '>10000'
            : (maxBoostedApy + maxInitialApy).toFixed()
        }%`,
      );

      // protocol's name
      await templateInstance.print(protocolNameFont, 117, 114, protocol.name);
    }

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
  express.route('/token/price-feed/:network').get(async (req, res) => {
    const network = Number(req.params.network);
    if (Number.isNaN(network)) {
      return res.status(400).send('invalid network');
    }
    let addresses: string[] = [];
    if (typeof req.query.tokens === 'string') addresses = [req.query.tokens];
    else if (Array.isArray(req.query.tokens)) addresses = req.query.tokens.map((v) => `${v}`);
    const tokens: Token[] = await container.model.tokenTable().where(function () {
      this.where('network', network);
      if (addresses.length > 0) {
        this.whereIn(
          'address',
          addresses.map((address) => `${address}`.toLowerCase()),
        );
      }
    });

    return res.json(
      tokens.reduce(
        (aliases, token) =>
          token.priceFeed
            ? { ...aliases, [token.address.toLowerCase()]: token.priceFeed }
            : aliases,
        {},
      ),
    );
  });
  express.route('/ethereum-abi/:network/:address').get(async (req, res) => {
    const { address, network } = req.params;
    if (!container.blockchain.ethereum.isNetwork(network)) {
      return res.status(400).send('invalid network');
    }

    const existing = await container.model
      .metadataTable()
      .where({
        blockchain: 'ethereum',
        network,
        address,
        type: MetadataType.EthereumContractAbi,
      })
      .first();

    if (existing) {
      return res.json(existing.value?.value ?? null);
    }

    const foundNetwork = container.blockchain.ethereum.byNetwork(network);
    const response = await axios.get(
      `${foundNetwork.etherscanApiURL}?module=contract&action=getabi&address=${address}`,
    );

    if (
      response.data?.result === '0' &&
      String(response.data?.result).includes('Max rate limit reached')
    ) {
      return res.status(503).send('Try next time');
    }

    if (
      response.data?.result === '0' &&
      String(response.data?.result).includes('Contract source code not verified')
    ) {
      return res.status(404).send('ABI not found');
    }

    let abi;
    try {
      abi = JSON.parse(response.data?.result);
      if (!Array.isArray(abi)) {
        throw new Error(response.data?.result);
      }
    } catch (e) {
      container.model.logService().create(`ethereum-abi:resolve`, `${network}:${address} ${e}`);
      return res.status(404).send('ABI not found');
    }

    await container.model
      .metadataService()
      .createOrUpdate(MetadataType.EthereumContractAbi, abi, 'ethereum', network, address);

    return res.json(abi);
  });
  express.get('/', (_, res) => res.status(200).send(''));
}
