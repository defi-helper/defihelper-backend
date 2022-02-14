import { tableFactoryLegacy } from '@services/Database';
import * as Conditions from '../../automate/condition';
import * as Actions from '../../automate/action';

export enum TriggerType {
  EveryMonth = 'everyMonth',
  EveryWeek = 'everyWeek',
  EveryDay = 'everyDay',
  EveryHour = 'everyHour',
  ContractEvent = 'contractEvent',
}

export type TriggerContractEventType = {
  type: TriggerType.ContractEvent;
  params: {
    network: string;
    address: string;
    event: string;
    callback?: string;
  };
};

export type TriggerTimeType = {
  type:
    | TriggerType.EveryHour
    | TriggerType.EveryDay
    | TriggerType.EveryWeek
    | TriggerType.EveryMonth;
  params: {};
};

export type TriggerTypes = TriggerContractEventType | TriggerTimeType;

export type Trigger = {
  id: string;
  wallet: string;
  name: string;
  active: boolean;
  retries: number;
  lastCallAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
} & TriggerTypes;

export const triggerTableName = 'automate_trigger';

export const triggerTableFactory = tableFactoryLegacy<Trigger>(triggerTableName);

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
  restakeAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export function getConditionHandler(condition: Condition) {
  return Conditions[condition.type].default as (
    this: Condition,
    params: ConditionParams<Condition['type']>,
  ) => boolean | Promise<boolean>;
}

export const conditionTableName = 'automate_condition';

export const conditionTableFactory = tableFactoryLegacy<Condition>(conditionTableName);

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
  return Actions[action.type].default as (
    this: Action,
    params: ActionParams<Action['type']>,
  ) => any;
}

export const actionTableName = 'automate_action';

export const actionTableFactory = tableFactoryLegacy<Action>(actionTableName);

export type ActionTable = ReturnType<ReturnType<typeof actionTableFactory>>;

export interface TriggerCallHistory {
  id: string;
  trigger: string;
  error: string | null;
  createdAt: Date;
}

export const triggerCallHistoryTableName = 'automate_trigger_call_history';

export const triggerCallHistoryTableFactory = tableFactoryLegacy<TriggerCallHistory>(
  triggerCallHistoryTableName,
);

export type TriggerCallHistoryTable = ReturnType<ReturnType<typeof triggerCallHistoryTableFactory>>;

export enum ContractVerificationStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
}

export interface Contract {
  id: string;
  wallet: string;
  protocol: string;
  contract: string | null;
  address: string;
  adapter: string;
  initParams: Object;
  verification: ContractVerificationStatus;
  rejectReason: string;
  archivedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export const contractTableName = 'automate_contract';

export const contractTableFactory = tableFactoryLegacy<Contract>(contractTableName);

export type ContractTable = ReturnType<ReturnType<typeof contractTableFactory>>;

export interface EthereumAutomateTransaction {
  hash: string | undefined;
  from: string | undefined;
  to: string | undefined;
  nonce: number;
  receipt?: {
    contractAddress: string | null;
    gasUsed: string;
    blockHash: string;
    blockNumber: number;
    confirmations: number;
    status: boolean;
  };
}

export interface WavesAutomateTransaction {
  id: string;
  type: number;
  recipient: string;
}

export type AutomateTransactionData = EthereumAutomateTransaction | WavesAutomateTransaction;

export interface AutomateTransaction {
  id: string;
  contract: string;
  consumer: string;
  data: AutomateTransactionData;
  confirmed: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export const transactionTableName = 'automate_transaction';

export const transactionTableFactory =
  tableFactoryLegacy<AutomateTransaction>(transactionTableName);

export type TransactionTable = ReturnType<ReturnType<typeof transactionTableFactory>>;
