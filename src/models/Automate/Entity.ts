import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';
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
  ) => boolean | Promise<boolean>;
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

export enum ContractVerificationStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Rejected = 'rejected',
}

export interface Contract {
  id: string;
  protocol: string;
  blockchain: Blockchain;
  network: string;
  address: string;
  adapter: string;
  wallet: string;
  verification: ContractVerificationStatus;
  rejectReason: string;
  updatedAt: Date;
  createdAt: Date;
}

export const contractTableName = 'automate_contract';

export const contractTableFactory = createTableFactory<Contract>(contractTableName);

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
  createTableFactory<AutomateTransaction>(transactionTableName);

export type TransactionTable = ReturnType<ReturnType<typeof transactionTableFactory>>;
