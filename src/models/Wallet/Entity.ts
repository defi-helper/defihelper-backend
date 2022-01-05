import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export enum WalletType {
  Wallet = 'wallet',
  Contract = 'contract',
}

export enum WalletSuspenseReason {
  LowFunds = 'lowFunds',
}

export interface Wallet {
  id: string;
  user: string;
  blockchain: Blockchain;
  network: string;
  type: WalletType;
  address: string;
  publicKey: string;
  name: string;
  suspendReason: WalletSuspenseReason | null;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'wallet';

export const tableFactory = createTableFactory<Wallet>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
