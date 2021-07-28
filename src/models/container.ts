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

  readonly queueTable = Models.Queue.Entity.tableFactory(this.parent.database);

  readonly queueService = singleton(() => new Models.Queue.Service.QueueService(this.queueTable));

  readonly userTable = Models.User.Entity.tableFactory(this.parent.database);

  readonly userService = singleton(() => new Models.User.Service.UserService(this.userTable));

  readonly sessionService = singleton(
    () =>
      new Models.User.Service.SessionService(
        this.parent.cache,
        'defihelper:session',
        this.parent.parent.session.ttl,
      ),
  );

  readonly walletTable = Models.Wallet.Entity.tableFactory(this.parent.database);

  readonly walletService = singleton(
    () => new Models.Wallet.Service.WalletService(this.walletTable),
  );

  readonly protocolTable = Models.Protocol.Entity.protocolTableFactory(this.parent.database);

  readonly protocolService = singleton(
    () => new Models.Protocol.Service.ProtocolService(this.protocolTable),
  );

  readonly contractTable = Models.Protocol.Entity.contractTableFactory(this.parent.database);

  readonly walletContractLinkTable = Models.Protocol.Entity.walletContractLinkTableFactory(
    this.parent.database,
  );

  readonly contractService = singleton(
    () =>
      new Models.Protocol.Service.ContractService(this.contractTable, this.walletContractLinkTable),
  );

  readonly tokenAliasTable = Models.Token.Entity.tokenAliasTableFactory(this.parent.database);

  readonly tokenAliasService = singleton(
    () => new Models.Token.Service.TokenAliasService(this.tokenAliasTable),
  );

  readonly tokenTable = Models.Token.Entity.tokenTableFactory(this.parent.database);

  readonly tokenService = singleton(() => new Models.Token.Service.TokenService(this.tokenTable));

  readonly proposalTable = Models.Proposal.Entity.proposalTableFactory(this.parent.database);

  readonly voteTable = Models.Proposal.Entity.voteTableFactory(this.parent.database);

  readonly proposalService = singleton(
    () => new Models.Proposal.Service.ProposalService(this.proposalTable, this.voteTable),
  );

  readonly metricContractTable = Models.Metric.Entity.metricContractTableFactory(
    this.parent.database,
  );

  readonly metricWalletTable = Models.Metric.Entity.metricWalletTableFactory(this.parent.database);

  readonly metricWalletTokenTable = Models.Metric.Entity.metricWalletTokenTableFactory(
    this.parent.database,
  );

  readonly metricService = singleton(
    () =>
      new Models.Metric.Service.MetricContractService(
        this.metricContractTable,
        this.metricWalletTable,
        this.metricWalletTokenTable,
        this.parent.parent.adapters.host,
      ),
  );

  readonly notificationTable = Models.Notification.Entity.notificationTableFactory(
    this.parent.database,
  );

  readonly userContactTable = Models.Notification.Entity.userContactTableFactory(
    this.parent.database,
  );

  readonly userEventSubscriptionTable =
    Models.Notification.Entity.userEventSubscriptionTableFactory(this.parent.database);

  readonly contractEventWebHookTable = Models.Notification.Entity.contractEventWebHookTableFactory(
    this.parent.database,
  );

  readonly notificationService = singleton(
    () => new Models.Notification.Service.NotificationService(this.notificationTable),
  );

  readonly userContactService = singleton(
    () =>
      new Models.Notification.Service.UserContactService(
        this.userContactTable,
        this.parent.parent.api.externalUrl,
      ),
  );

  readonly userEventSubscriptionService = singleton(
    () =>
      new Models.Notification.Service.UserEventSubscriptionService(this.userEventSubscriptionTable),
  );

  readonly contractEventWebHookService = singleton(
    () =>
      new Models.Notification.Service.ContractEventWebHookService(this.contractEventWebHookTable),
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
}
