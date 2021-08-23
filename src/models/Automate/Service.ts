import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { Wallet } from '@models/Wallet/Entity';
import {
  Action,
  ActionParams,
  ActionTable,
  ActionType,
  Condition,
  ConditionParams,
  ConditionTable,
  ConditionType,
  Trigger,
  TriggerTable,
  TriggerType,
} from './Entity';

export class AutomateService {
  constructor(
    readonly triggerTable: Factory<TriggerTable>,
    readonly conditionTable: Factory<ConditionTable>,
    readonly actionTable: Factory<ActionTable>,
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
}
