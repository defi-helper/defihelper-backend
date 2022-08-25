import { resolve } from 'path';
import { Container, singleton } from '@services/Container';
import AppContainer from '@container';
import * as Models from '@models/index';

export class ModelContainer extends Container<typeof AppContainer> {
  readonly migrationTable = Models.Migration.Entity.tableFactory(this.parent.database);

  readonly migrationService = singleton(
    Models.Migration.Service.factory(
      this.parent.logger,
      this.parent.database,
      this.migrationTable,
      resolve(__dirname, '../migrations'),
    ),
  );

  readonly logTable = Models.Log.Entity.logTableFactory(this.parent.database);

  readonly logService = singleton(() => new Models.Log.Service.LogService(this.logTable));

  readonly referrerCodeTable = Models.ReferrerCode.Entity.referrerCodeTableFactory(
    this.parent.database,
  );

  readonly referrerCodeService = singleton(
    () => new Models.ReferrerCode.Service.ReferrerCodeService(this.referrerCodeTable),
  );

  readonly queueTable = Models.Queue.Entity.tableFactory(this.parent.database);

  readonly queueService = singleton(
    () =>
      new Models.Queue.Service.QueueService(
        this.queueTable,
        this.parent.rabbitmq,
        this.logService,
        this.parent.logger,
      ),
  );

  readonly walletTable = Models.Wallet.Entity.walletTableFactory(this.parent.database);

  readonly walletService = singleton(
    () =>
      new Models.Wallet.Service.WalletService(
        this.parent.database(),
        this.walletTable,
        this.walletExchangeTable,
        this.walletBlockchainTable,
        this.parent.cryptography(),
      ),
  );

  readonly walletBlockchainTable = Models.Wallet.Entity.walletBlockchainTableFactory(
    this.parent.database,
  );

  readonly walletExchangeTable = Models.Wallet.Entity.walletExchangeTableFactory(
    this.parent.database,
  );

  readonly sessionService = singleton(
    () =>
      new Models.User.Service.SessionService(
        this.parent.cache,
        'defihelper:session',
        this.parent.parent.session.ttl,
      ),
  );

  readonly userTable = Models.User.Entity.tableFactory(this.parent.database);

  readonly userService = singleton(
    () =>
      new Models.User.Service.UserService(this.userTable, this.sessionService, this.walletService),
  );

  readonly userNotificationTable = Models.UserNotification.Entity.userNotificationTableFactory(
    this.parent.database,
  );

  readonly userNotificationService = singleton(
    () => new Models.UserNotification.Service.UserNotificationService(this.userNotificationTable),
  );

  readonly protocolTable = Models.Protocol.Entity.protocolTableFactory(this.parent.database);

  readonly protocolUserFavoriteTable = Models.Protocol.Entity.protocolUserFavoriteTableFactory(
    this.parent.database,
  );

  readonly protocolService = singleton(
    () =>
      new Models.Protocol.Service.ProtocolService(
        this.protocolTable,
        this.protocolUserFavoriteTable,
      ),
  );

  readonly protocolSocialPostTable = Models.Protocol.Social.Entity.postTableFactory(
    this.parent.database,
  );

  readonly protocolSocialService = singleton(
    () => new Models.Protocol.Social.Service.ProtocolSocialService(this.protocolSocialPostTable),
  );

  readonly contractTable = Models.Protocol.Entity.contractTableFactory(this.parent.database);

  readonly contractBlockchainTable = Models.Protocol.Entity.contractBlockchainTableFactory(
    this.parent.database,
  );

  readonly contractDebankTable = Models.Protocol.Entity.contractDebankTableFactory(
    this.parent.database,
  );

  readonly walletContractLinkTable = Models.Protocol.Entity.walletContractLinkTableFactory(
    this.parent.database,
  );

  readonly tokenContractLinkTable = Models.Protocol.Entity.tokenContractLinkTableFactory(
    this.parent.database,
  );

  readonly userContractLinkTable = Models.Protocol.Entity.userContractLinkTableFactory(
    this.parent.database,
  );

  readonly contractService = singleton(
    () =>
      new Models.Protocol.Service.ContractService(
        this.parent.database(),
        this.contractTable,
        this.contractBlockchainTable,
        this.contractDebankTable,
        this.walletContractLinkTable,
        this.tokenContractLinkTable,
        this.userContractLinkTable,
      ),
  );

  readonly tokenAliasTable = Models.Token.Entity.tokenAliasTableFactory(this.parent.database);

  readonly tokenAliasService = singleton(
    () => new Models.Token.Service.TokenAliasService(this.tokenAliasTable),
  );

  readonly tokenTable = Models.Token.Entity.tokenTableFactory(this.parent.database);

  readonly tokenPartTable = Models.Token.Entity.tokenPartTableFactory(this.parent.database);

  readonly tokenService = singleton(
    () => new Models.Token.Service.TokenService(this.tokenTable, this.tokenPartTable),
  );

  readonly proposalTable = Models.Proposal.Entity.proposalTableFactory(this.parent.database);

  readonly voteTable = Models.Proposal.Entity.voteTableFactory(this.parent.database);

  readonly proposalTagTable = Models.Proposal.Entity.tagTableFactory(this.parent.database);

  readonly proposalService = singleton(
    () =>
      new Models.Proposal.Service.ProposalService(
        this.proposalTable,
        this.voteTable,
        this.proposalTagTable,
      ),
  );

  readonly metricBlockchainTable = Models.Metric.Entity.metricBlockchainTableFactory(
    this.parent.database,
  );

  readonly metricProtocolTable = Models.Metric.Entity.metricProtocolTableFactory(
    this.parent.database,
  );

  readonly metricContractTable = Models.Metric.Entity.metricContractTableFactory(
    this.parent.database,
  );

  readonly metricContractTaskTable = Models.Metric.Entity.metricContractTaskTableFactory(
    this.parent.database,
  );

  readonly metricWalletTable = Models.Metric.Entity.metricWalletTableFactory(this.parent.database);

  readonly metricWalletRegistryTable = Models.Metric.Entity.metricWalletRegistryTableFactory(
    this.parent.database,
  );

  readonly metricContractRegistryTable = Models.Metric.Entity.metricContractRegistryTableFactory(
    this.parent.database,
  );

  readonly metricWalletTaskTable = Models.Metric.Entity.metricWalletTaskTableFactory(
    this.parent.database,
  );

  readonly metricWalletTokenTable = Models.Metric.Entity.metricWalletTokenTableFactory(
    this.parent.database,
  );

  readonly metricWalletTokenRegistryTable =
    Models.Metric.Entity.metricWalletTokenRegistryTableFactory(this.parent.database);

  readonly metricTokenTable = Models.Metric.Entity.metricTokenTableFactory(this.parent.database);

  readonly metricService = singleton(
    () =>
      new Models.Metric.Service.MetricContractService(
        this.parent.database,
        this.metricBlockchainTable,
        this.metricProtocolTable,
        this.metricContractTable,
        this.metricContractTaskTable,
        this.metricWalletTable,
        this.metricWalletRegistryTable,
        this.metricWalletTaskTable,
        this.metricWalletTokenTable,
        this.metricWalletTokenRegistryTable,
        this.metricTokenTable,
      ),
  );

  readonly notificationTable = Models.Notification.Entity.notificationTableFactory(
    this.parent.database,
  );

  readonly userContactTable = Models.Notification.Entity.userContactTableFactory(
    this.parent.database,
  );

  readonly notificationService = singleton(
    () => new Models.Notification.Service.NotificationService(this.notificationTable),
  );

  readonly userContactService = singleton(
    () => new Models.Notification.Service.UserContactService(this.userContactTable),
  );

  readonly billingBillTable = Models.Billing.Entity.billTableFactory(this.parent.database);

  readonly billingTransferTable = Models.Billing.Entity.transferTableFactory(this.parent.database);

  readonly billingService = singleton(
    () =>
      new Models.Billing.Service.BillingService(this.billingBillTable, this.billingTransferTable),
  );

  readonly storeProductTable = Models.Store.Entity.productTableFactory(this.parent.database);

  readonly storePurchaseTable = Models.Store.Entity.purchaseTableFactory(this.parent.database);

  readonly storeService = singleton(
    () =>
      new Models.Store.Service.StoreService(
        this.storeProductTable,
        this.storePurchaseTable,
        this.notificationTable,
      ),
  );

  readonly metadataTable = Models.Protocol.Entity.metadataTableFactory(this.parent.database);

  readonly metadataService = singleton(
    () => new Models.Protocol.Service.MetadataService(this.metadataTable),
  );

  readonly govProposalTable = Models.Governance.Entity.proposalTableFactory(this.parent.database);

  readonly govReceiptTable = Models.Governance.Entity.receiptTableFactory(this.parent.database);

  readonly governanceService = singleton(
    () =>
      new Models.Governance.Service.GovernanceService(
        this.govProposalTable,
        this.govReceiptTable,
        this.parent.semafor,
      ),
  );

  readonly automateTriggerTable = Models.Automate.Entity.triggerTableFactory(this.parent.database);

  readonly automateConditionTable = Models.Automate.Entity.conditionTableFactory(
    this.parent.database,
  );

  readonly automateActionTable = Models.Automate.Entity.actionTableFactory(this.parent.database);

  readonly automateTriggerCallHistoryTable = Models.Automate.Entity.triggerCallHistoryTableFactory(
    this.parent.database,
  );

  readonly automateContractTable = Models.Automate.Entity.contractTableFactory(
    this.parent.database,
  );

  readonly automateTransactionTable = Models.Automate.Entity.transactionTableFactory(
    this.parent.database,
  );

  readonly automateService = singleton(
    () =>
      new Models.Automate.Service.AutomateService(
        this.automateTriggerTable,
        this.automateConditionTable,
        this.automateActionTable,
        this.automateTriggerCallHistoryTable,
        this.automateContractTable,
        this.automateTransactionTable,
        this.walletTable,
      ),
  );
}
