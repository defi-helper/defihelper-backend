import { typedTableFactory } from '@services/Database';
import { Blockchain as BlockchainType } from '@models/types';

export enum WalletType {
  Wallet = 'wallet',
  Contract = 'contract',
}

export type WalletChild<T extends WalletSource> = T extends WalletSource.Blockchain
  ? WalletBlockchain
  : T extends WalletSource.Exchange
  ? WalletExchange
  : never;

export type WalletValues<T extends WalletSource> = Omit<WalletChild<T>, 'id'>;

export enum WalletSource {
  Blockchain = 'blockchain',
  Exchange = 'exchange',
}

export enum WalletExchangeType {
  Binance = 'binance',
}

export enum WalletSuspenseReason {
  LowFunds = 'lowFunds',
}

export interface Wallet {
  id: string;
  user: string;
  type: WalletType;
  name: string;
  suspendReason: WalletSuspenseReason | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface WalletBlockchain {
  id: string;
  blockchain: BlockchainType;
  network: string;
  address: string;
  publicKey: string;
}

export interface WalletExchange {
  id: string;
  type: WalletExchangeType;
  payload: string; // encoded json
}

export const walletTableName = 'wallet';
export const walletBlockchainTableName = 'wallet_blockchain';
export const walletExchangeTableName = 'wallet_exchange';

export const walletTableFactory = typedTableFactory(walletTableName);
export const walletBlockchainTableFactory = typedTableFactory(walletBlockchainTableName);
export const walletExchangeTableFactory = typedTableFactory(walletExchangeTableName);

export type WalletTable = ReturnType<ReturnType<typeof walletTableFactory>>;
export type WalletBlockchainTable = ReturnType<ReturnType<typeof walletBlockchainTableFactory>>;
export type WalletExchangeTable = ReturnType<ReturnType<typeof walletExchangeTableFactory>>;

declare module 'knex/types/tables' {
  interface Tables {
    [walletTableName]: Wallet;
    [walletBlockchainTableName]: WalletBlockchain;
    [walletExchangeTableName]: WalletExchange;
  }
}
