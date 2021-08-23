import { tableFactory as createTableFactory } from '@services/Database';
import * as Conditions from '../../automate/condition';
import * as Actions from '../../automate/action';

export enum TriggerType {
  EveryMonth = 'everyMonth',
  EveryWeek = 'everyWeek',
  EveryDay = 'everyDay',
  EveryHour = 'everyHour',
}

export interface Trigger {
  id: string;
  type: TriggerType;
  wallet: string;
  name: string;
  active: boolean;
  lastCallAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export const triggerTableName = 'automate_trigger';

export const triggerTableFactory = createTableFactory<Trigger>(triggerTableName);

export type TriggerTable = ReturnType<ReturnType<typeof triggerTableFactory>>;

export type Params<H> = H extends (arg: infer T) => any ? T : never;

export type ConditionType = keyof typeof Conditions;

export type ConditionParams<T extends ConditionType> = Params<typeof Conditions[T]['default']>;

export interface Condition {
  id: string;
  trigger: string;
  type: ConditionType;
  params: ConditionParams<ConditionType>;
  priority: number;
  updatedAt: Date;
  createdAt: Date;
}

export function getConditionHandler(condition: Condition) {
  return Conditions[condition.type].default as (
    params: ConditionParams<Condition['type']>,
  ) => boolean;
}

export const conditionTableName = 'automate_condition';

export const conditionTableFactory = createTableFactory<Condition>(conditionTableName);

export type ConditionTable = ReturnType<ReturnType<typeof conditionTableFactory>>;

export type ActionType = keyof typeof Actions;

export type ActionParams<T extends ActionType> = Params<typeof Actions[T]['default']>;

export interface Action {
  id: string;
  trigger: string;
  type: ActionType;
  params: ActionParams<ActionType>;
  priority: number;
  updatedAt: Date;
  createdAt: Date;
}

export function getActionHandler(action: Action) {
  return Actions[action.type].default as (params: ActionParams<Action['type']>) => any;
}

export const actionTableName = 'automate_action';

export const actionTableFactory = createTableFactory<Action>(actionTableName);

export type ActionTable = ReturnType<ReturnType<typeof actionTableFactory>>;
