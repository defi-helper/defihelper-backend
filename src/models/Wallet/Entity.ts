import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export interface Wallet {
  id: string;
  user: string;
  blockchain: Blockchain;
  network: string;
  address: string;
  publicKey: string;
  name: string;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'wallet';

export const tableFactory = createTableFactory<Wallet>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
