import { tableFactory as createTableFactory } from '@services/Database';
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
  hidden: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export const protocolTableName = 'protocol';

export const protocolTableFactory = createTableFactory<Protocol>(protocolTableName);

export type ProtocolTable = ReturnType<ReturnType<typeof protocolTableFactory>>;

export interface ContractAutomate {
  adapters: string[];
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
  updatedAt: Date;
  createdAt: Date;
}

export const contractTableName = 'protocol_contract';

export const contractTableFactory = createTableFactory<Contract>(contractTableName);

export type ContractTable = ReturnType<ReturnType<typeof contractTableFactory>>;

export interface WalletContractLink {
  id: string;
  contract: string;
  wallet: string;
  createdAt: Date;
}

export const walletContractLinkTableName = 'protocol_contract_wallet_link';

export const walletContractLinkTableFactory = createTableFactory<WalletContractLink>(
  walletContractLinkTableName,
);

export type WalletContractLinkTable = ReturnType<ReturnType<typeof walletContractLinkTableFactory>>;
