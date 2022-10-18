import container from '@container';
import dayjs from 'dayjs';
import { Emitter } from '@services/Event';
import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Protocol, Contract as ProtocolContract } from '@models/Protocol/Entity';
import {
  Wallet,
  WalletBlockchain,
  walletBlockchainTableName,
  WalletTable,
  walletTableName,
} from '@models/Wallet/Entity';
import {
  Action,
  ActionParams,
  ActionTable,
  ActionType,
  AutomateTransaction,
  AutomateTransactionData,
  Condition,
  ConditionParams,
  ConditionTable,
  ConditionType,
  Contract,
  ContractStopLoss,
  ContractStopLossStatus,
  ContractStopLossTable,
  ContractTable,
  ContractType,
  ContractVerificationStatus,
  TransactionTable,
  Trigger,
  TriggerCallHistory,
  TriggerCallHistoryTable,
  TriggerTable,
  TriggerType,
  TriggerTypes,
} from './Entity';

export class AutomateService {
  public readonly onTriggerCreated = new Emitter<Trigger>(async (trigger) => {
    if (trigger.type === TriggerType.ContractEvent) {
      await container.model.queueService().push('followContractEvent', {
        trigger: trigger.id,
      });
    }
  });

  public readonly onTriggerDeleted = new Emitter<Trigger>();

  public readonly onContractCreated = new Emitter<{
    blockchainWallet: Wallet & WalletBlockchain;
    contract: Contract;
  }>(({ blockchainWallet, contract }) => {
    if (blockchainWallet.blockchain === 'ethereum') {
      container.model.queueService().push('automateContractEthereumVerify', {
        id: contract.id,
      });
    } else if (blockchainWallet.blockchain === 'waves') {
      container.model.queueService().push('automateContractWavesVerify', {
        id: contract.id,
      });
    }
  });

  public readonly onTransactionCreated = new Emitter<{
    blockchainWallet: Wallet & WalletBlockchain;
    contract: Contract;
    transaction: AutomateTransaction;
  }>(async ({ blockchainWallet, transaction }) => {
    if (blockchainWallet.blockchain === 'ethereum') {
      const network = container.blockchain.ethereum.byNetwork(blockchainWallet.network);
      container.model.queueService().push(
        'automateTransactionEthereumConfirm',
        {
          id: transaction.id,
        },
        {
          startAt: dayjs().add(network.avgBlockTime, 'seconds').toDate(),
        },
      );
    } else if (blockchainWallet.blockchain === 'waves') {
      container.model.queueService().push(
        'automateTransactionWavesConfirm',
        {
          id: transaction.id,
        },
        {
          startAt: dayjs().add(10, 'seconds').toDate(),
        },
      );
    }
  });

  public readonly onStopLossEnabled = new Emitter<{ stopLoss: ContractStopLoss }>(
    ({ stopLoss }) => {
      container.model
        .queueService()
        .push('eventsAutomateContractStopLossEnabled', { id: stopLoss.id });
    },
  );

  constructor(
    readonly triggerTable: Factory<TriggerTable>,
    readonly conditionTable: Factory<ConditionTable>,
    readonly actionTable: Factory<ActionTable>,
    readonly triggerCallHistoryTable: Factory<TriggerCallHistoryTable>,
    readonly contractTable: Factory<ContractTable>,
    readonly contractStopLossTable: Factory<ContractStopLossTable>,
    readonly transactionTable: Factory<TransactionTable>,
    readonly walletTable: Factory<WalletTable>,
  ) {}

  async createTrigger(wallet: Wallet, type: TriggerTypes, name: string, active: boolean = true) {
    const created: Trigger = {
      id: uuid(),
      wallet: wallet.id,
      ...type,
      name,
      active,
      retries: 0,
      lastCallAt: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.triggerTable().insert(created);
    this.onTriggerCreated.emit(created);

    return created;
  }

  async resetTriggerRetries(trigger: Trigger) {
    if (trigger.retries < 1) {
      return trigger;
    }

    const updated: Trigger = {
      ...trigger,
      retries: 0,
      updatedAt: new Date(),
    };
    await this.triggerTable().where({ id: trigger.id }).update(updated);

    return updated;
  }

  async incrementTriggerRetries(trigger: Trigger) {
    const c = await this.triggerTable().where({ id: trigger.id }).increment('retries', 1);

    if (c >= 3) {
      const t = await this.updateTrigger({
        ...trigger,
        active: false,
      });

      return t;
    }

    return {
      ...trigger,
      retries: c,
    };
  }

  async updateTrigger(trigger: Trigger) {
    const updated: Trigger = {
      ...trigger,
      updatedAt: new Date(),
    };
    await this.triggerTable().where({ id: trigger.id }).update(updated);

    return updated;
  }

  async deleteTrigger(trigger: Trigger) {
    await this.triggerTable().where({ id: trigger.id }).delete();
    this.onTriggerDeleted.emit(trigger);
  }

  async createCondition(
    trigger: Trigger,
    type: ConditionType,
    params: ConditionParams<ConditionType>,
    priority: number,
  ) {
    const created: Condition = {
      id: uuid(),
      trigger: trigger.id,
      type,
      params,
      priority,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.conditionTable().insert(created);

    return created;
  }

  async updateCondition(condition: Condition) {
    const updated: Condition = {
      ...condition,
      updatedAt: new Date(),
    };
    await this.conditionTable().where({ id: condition.id }).update(updated);

    return updated;
  }

  async deleteCondition(condition: Condition) {
    await this.conditionTable().where({ id: condition.id }).delete();
  }

  async createAction(
    trigger: Trigger,
    type: ActionType,
    params: ActionParams<ActionType>,
    priority: number,
  ) {
    const created: Action = {
      id: uuid(),
      trigger: trigger.id,
      type,
      params,
      priority,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.actionTable().insert(created);

    return created;
  }

  async updateAction(action: Action) {
    const updated: Action = {
      ...action,
      updatedAt: new Date(),
    };
    await this.actionTable().where({ id: action.id }).update(updated);

    return updated;
  }

  async deleteAction(action: Action) {
    await this.actionTable().where({ id: action.id }).delete();
  }

  async createTriggerCallHistory(trigger: Trigger, error?: Error) {
    const created: TriggerCallHistory = {
      id: uuid(),
      trigger: trigger.id,
      error: error ? error.message : null,
      createdAt: new Date(),
    };

    await this.triggerCallHistoryTable().insert(created);

    return created;
  }

  async createContract(
    type: ContractType,
    blockchainWallet: Wallet & WalletBlockchain,
    protocol: Protocol,
    contract: ProtocolContract | null,
    address: string,
    adapter: string,
    initParams: Object,
  ) {
    const created: Contract = {
      id: uuid(),
      type,
      wallet: blockchainWallet.id,
      protocol: protocol.id,
      contract: contract?.id ?? null,
      address,
      adapter,
      initParams,
      verification: ContractVerificationStatus.Pending,
      rejectReason: '',
      archivedAt: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.contractTable().insert(created);
    this.onContractCreated.emit({ blockchainWallet, contract: created });

    return created;
  }

  async updateContract(contract: Contract) {
    const updated: Contract = {
      ...contract,
      updatedAt: new Date(),
    };
    await this.contractTable().where({ id: contract.id }).update(updated);

    return updated;
  }

  async deleteContract(contract: Contract) {
    await this.contractTable().where({ id: contract.id }).delete();
  }

  async enableStopLoss(
    contract: Contract,
    path: string[],
    amountOut: string,
    amountOutMin: string,
  ) {
    await this.disableStopLoss(contract);
    const created: ContractStopLoss = {
      id: uuid(),
      contract: contract.id,
      stopLoss: {
        path,
        amountOut,
        amountOutMin,
        inToken: null,
        outToken: null,
      },
      status: ContractStopLossStatus.Pending,
      tx: '',
      task: null,
      rejectReason: '',
      amountOut: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.contractStopLossTable().insert(created);
    this.onStopLossEnabled.emit({ stopLoss: created });

    return created;
  }

  async disableStopLoss(contract: Contract) {
    await this.contractStopLossTable().where('contract', contract.id).delete();
  }

  async updateStopLoss(stopLoss: ContractStopLoss) {
    const updated: ContractStopLoss = {
      ...stopLoss,
      updatedAt: new Date(),
    };
    await this.contractStopLossTable().where('id', stopLoss.id).update(updated);

    return updated;
  }

  async createTransaction<T extends AutomateTransactionData>(
    contract: Contract,
    consumer: string,
    data: T,
  ) {
    const blockchainWallet = await this.walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .where(`${walletTableName}.id`, contract.wallet)
      .first();
    if (!blockchainWallet) throw new Error('Wallet not found');

    const created: AutomateTransaction = {
      id: uuid(),
      contract: contract.id,
      consumer,
      data,
      confirmed: false,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.transactionTable().insert(created);
    this.onTransactionCreated.emit({ blockchainWallet, contract, transaction: created });

    return created;
  }

  async updateTransaction(transaction: AutomateTransaction) {
    const updated: AutomateTransaction = {
      ...transaction,
      updatedAt: new Date(),
    };
    await this.transactionTable().where({ id: transaction.id }).update(updated);

    return updated;
  }

  async deleteTransaction(transaction: AutomateTransaction) {
    await this.transactionTable().where({ id: transaction.id }).delete();
  }
}
