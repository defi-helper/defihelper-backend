import { Blockchain } from '@models/types';
import container from '@container';
import { Emitter } from '@services/Event';
import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Protocol } from '@models/Protocol/Entity';
import { Wallet } from '@models/Wallet/Entity';
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
  ContractTable,
  ContractVerificationStatus,
  TransactionTable,
  Trigger,
  TriggerTable,
  TriggerType,
} from './Entity';

export class AutomateService {
  public readonly onContractCreated = new Emitter<Contract>((contract) => {
    if (contract.blockchain === 'ethereum') {
      container.model.queueService().push('automateContractEthereumVerify', {
        id: contract.id,
      });
    }
  });

  public readonly onTransactionCreated = new Emitter<AutomateTransaction>(async (transaction) => {
    const contract = await this.contractTable().where('id', transaction.contract).first();
    if (!contract) return;

    if (contract.blockchain === 'ethereum') {
      container.model.queueService().push('automateTransactionEthereumConfirm', {
        id: transaction.id,
      });
    }
  });

  constructor(
    readonly triggerTable: Factory<TriggerTable>,
    readonly conditionTable: Factory<ConditionTable>,
    readonly actionTable: Factory<ActionTable>,
    readonly contractTable: Factory<ContractTable>,
    readonly transactionTable: Factory<TransactionTable>,
  ) {}

  async createTrigger(wallet: Wallet, type: TriggerType, name: string) {
    const created: Trigger = {
      id: uuid(),
      wallet: wallet.id,
      type,
      name,
      active: true,
      lastCallAt: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.triggerTable().insert(created);

    return created;
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

  async createContract(
    protocol: Protocol,
    blockchain: Blockchain,
    network: string,
    address: string,
    adapter: string,
    wallet: Wallet,
  ) {
    const created: Contract = {
      id: uuid(),
      protocol: protocol.id,
      blockchain,
      network,
      address,
      adapter,
      wallet: wallet.id,
      verification: ContractVerificationStatus.Pending,
      rejectReason: '',
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.contractTable().insert(created);
    this.onContractCreated.emit(created);

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

  async createTransaction<T extends AutomateTransactionData>(
    contract: Contract,
    consumer: string,
    data: T,
  ) {
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
    this.onTransactionCreated.emit(created);

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
