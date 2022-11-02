import { typedTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export interface ProtocolLink {
  id: string;
  name: string;
  value: string;
}

export interface ProtocolLinkMap {
  social?: ProtocolLink[];
  listing?: ProtocolLink[];
  audit?: ProtocolLink[];
  other?: ProtocolLink[];
}

export interface Protocol {
  id: string;
  adapter: string;
  name: string;
  description: string;
  icon: string | null;
  link: string | null;
  links: ProtocolLinkMap;
  debankId: string | null;
  hidden: boolean;
  metric: { tvl?: string };
  updatedAt: Date;
  createdAt: Date;
  previewPicture: string | null;
}

export const protocolTableName = 'protocol';

export const protocolTableFactory = typedTableFactory(protocolTableName);

export type ProtocolTable = ReturnType<ReturnType<typeof protocolTableFactory>>;

export interface ProtocolUserFavorite {
  id: string;
  protocol: string;
  user: string;
  createdAt: Date;
}

export const protocolUserFavoriteTableName = 'protocol_user_favorite';

export const protocolUserFavoriteTableFactory = typedTableFactory(protocolUserFavoriteTableName);

export type ProtocolUserFavoriteTable = ReturnType<
  ReturnType<typeof protocolUserFavoriteTableFactory>
>;

export interface ContractAutomate {
  autorestakeAdapter?: string;
  adapters: string[];
  lpTokensManager?: {
    router: string;
    pair: string;
  };
}

export enum ContractRiskFactor {
  notCalculated = 'notCalculated',
  low = 'low',
  moderate = 'moderate',
  high = 'high',
}
export interface ContractMetric {
  tvl?: string;
  aprDay?: string;
  aprWeek?: string;
  aprMonth?: string;
  aprYear?: string;
  aprBoosted?: string;
  aprWeekReal?: string;
  risk?: ContractRiskFactor;
}

export interface Contract {
  id: string;
  protocol: string;
  layout: string;
  name: string;
  description: string;
  link: string | null;
  hidden: boolean;
  deprecated: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export interface ContractDebankType {
  id: string;
  address: string;
  metric: ContractMetric;
}

export interface ContractBlockchainType {
  id: string;
  blockchain: Blockchain;
  network: string;
  address: string;
  deployBlockNumber: string | null;
  watcherId: string | null;
  adapter: string;
  automate: ContractAutomate;
  metric: ContractMetric;
}

export interface ContractMigratableRemindersBulk {
  id: string;
  wallet: string;
  contract: string;
  processed: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export const contractMigratableRemindersBulkTableName =
  'protocol_contract_migratable_reminders_bulk';
export const contractMigratableRemindersBulkTableFactory = typedTableFactory(
  contractMigratableRemindersBulkTableName,
);
export type ContractMigratableRemindersBulkTable = ReturnType<
  ReturnType<typeof contractMigratableRemindersBulkTableFactory>
>;

export const contractTableName = 'protocol_contract';
export const contractTableFactory = typedTableFactory(contractTableName);
export type ContractTable = ReturnType<ReturnType<typeof contractTableFactory>>;

export const contractDebankTableName = 'protocol_contract_debank';
export const contractDebankTableFactory = typedTableFactory(contractDebankTableName);
export type ContractDebankTable = ReturnType<ReturnType<typeof contractDebankTableFactory>>;

export const contractBlockchainTableName = 'protocol_contract_blockchain';
export const contractBlockchainTableFactory = typedTableFactory(contractBlockchainTableName);
export type ContractBlockchainTable = ReturnType<ReturnType<typeof contractBlockchainTableFactory>>;

export interface WalletContractLink {
  id: string;
  contract: string;
  wallet: string;
  createdAt: Date;
}

export const walletContractLinkTableName = 'protocol_contract_wallet_link';
export const walletContractLinkTableFactory = typedTableFactory(walletContractLinkTableName);
export type WalletContractLinkTable = ReturnType<ReturnType<typeof walletContractLinkTableFactory>>;

export interface TagContractLink {
  id: string;
  contract: string;
  tag: string;
  createdAt: Date;
}

export const tagContractLinkTableName = 'protocol_contract_tag_link';
export const tagContractLinkTableFactory = typedTableFactory(tagContractLinkTableName);
export type TagContractLinkTable = ReturnType<ReturnType<typeof tagContractLinkTableFactory>>;

export enum MetadataType {
  EthereumContractAbi = 'ethereumContractAbi',
}
export interface Metadata {
  id: string;
  contract: string | null;
  type: MetadataType;
  value: { value: any };
  blockchain: string | null;
  network: string | null;
  address: string | null;
  createdAt: Date;
}

export const metadataTableName = 'protocol_contract_metadata';

export const metadataTableFactory = typedTableFactory(metadataTableName);

export type MetadataTable = ReturnType<ReturnType<typeof metadataTableFactory>>;

export enum TokenContractLinkType {
  Stake = 'stake',
  Reward = 'reward',
}

export interface TokenContractLink {
  id: string;
  contract: string;
  token: string;
  type: TokenContractLinkType;
  createdAt: Date;
}

export const tokenContractLinkTableName = 'protocol_contract_token_link';

export const tokenContractLinkTableFactory = typedTableFactory(tokenContractLinkTableName);

export type TokenContractLinkTable = ReturnType<ReturnType<typeof tokenContractLinkTableFactory>>;

export enum UserContractLinkType {
  AutorestakeHide = 'autorestakeHide',
}

export interface UserContractLink {
  id: string;
  contract: string;
  user: string;
  type: UserContractLinkType;
  createdAt: Date;
}

export const userContractLinkTableName = 'protocol_contract_user_link';

export const userContractLinkTableFactory = typedTableFactory(userContractLinkTableName);

export type UserContractLinkTable = ReturnType<ReturnType<typeof userContractLinkTableFactory>>;

declare module 'knex/types/tables' {
  interface Tables {
    [tagContractLinkTableName]: TagContractLink;
    [protocolTableName]: Protocol;
    [metadataTableName]: Metadata;
    [contractTableName]: Contract;
    [walletContractLinkTableName]: WalletContractLink;
    [protocolUserFavoriteTableName]: ProtocolUserFavorite;
    [contractDebankTableName]: ContractDebankType;
    [contractBlockchainTableName]: ContractBlockchainType;
    [tokenContractLinkTableName]: TokenContractLink;
    [userContractLinkTableName]: UserContractLink;
    [contractMigratableRemindersBulkTableName]: ContractMigratableRemindersBulk;
  }
}
