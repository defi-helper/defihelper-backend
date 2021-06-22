import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export interface Protocol {
  id: string;
  adapter: string;
  name: string;
  description: string;
  icon: string | null;
  link: string | null;
  hidden: boolean;
  updatedAt: Date;
  createdAt: Date;
}

export const protocolTableName = 'protocol';

export const protocolTableFactory = createTableFactory<Protocol>(protocolTableName);

export type ProtocolTable = ReturnType<ReturnType<typeof protocolTableFactory>>;

export interface Contract {
  id: string;
  protocol: string;
  blockchain: Blockchain;
  network: string;
  address: string;
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
