import { tableFactoryLegacy } from '@services/Database';
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

export const protocolTableFactory = tableFactoryLegacy<Protocol>(protocolTableName);

export type ProtocolTable = ReturnType<ReturnType<typeof protocolTableFactory>>;

export interface ProtocolUserFavorite {
  id: string;
  protocol: string;
  user: string;
  createdAt: Date;
}

export const protocolUserFavoriteTableName = 'protocol_user_favorite';

export const protocolUserFavoriteTableFactory = tableFactoryLegacy<ProtocolUserFavorite>(
  protocolUserFavoriteTableName,
);

export type ProtocolUserFavoriteTable = ReturnType<
  ReturnType<typeof protocolUserFavoriteTableFactory>
>;

export interface ContractAutomate {
  autorestakeAdapter?: string;
  adapters: string[];
  buyLiquidity?: {
    router: string;
    pair: string;
  };
}

export interface ContractMetric {
  tvl?: string;
  aprDay?: string;
  aprWeek?: string;
  aprMonth?: string;
  aprYear?: string;
}

export interface Contract {
  id: string;
  protocol: string;
  blockchain: Blockchain;
  network: string;
  address: string;
  deployBlockNumber: string | null;
  adapter: string;
  layout: string;
  automate: ContractAutomate;
  name: string;
  description: string;
  link: string | null;
  hidden: boolean;
  debankAddress: string | null;
  metric: ContractMetric;
  updatedAt: Date;
  createdAt: Date;
}

export const contractTableName = 'protocol_contract';

export const contractTableFactory = tableFactoryLegacy<Contract>(contractTableName);

export type ContractTable = ReturnType<ReturnType<typeof contractTableFactory>>;

export interface WalletContractLink {
  id: string;
  contract: string;
  wallet: string;
  createdAt: Date;
}

export const walletContractLinkTableName = 'protocol_contract_wallet_link';

export const walletContractLinkTableFactory = tableFactoryLegacy<WalletContractLink>(
  walletContractLinkTableName,
);

export type WalletContractLinkTable = ReturnType<ReturnType<typeof walletContractLinkTableFactory>>;

export enum MetadataType {
  EthereumContractAbi = 'ethereumContractAbi',
}
export interface Metadata {
  id: string;
  contract: string;
  type: MetadataType;
  value: { value: any };
  createdAt: Date;
}

export const metadataTableName = 'protocol_contract_metadata';

export const metadataTableFactory = tableFactoryLegacy<Metadata>(metadataTableName);

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

export const tokenContractLinkTableFactory = tableFactoryLegacy<TokenContractLink>(
  tokenContractLinkTableName,
);

export type TokenContractLinkTable = ReturnType<ReturnType<typeof tokenContractLinkTableFactory>>;
