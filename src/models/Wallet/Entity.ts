import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain } from '@models/types';

export enum WalletType {
  Wallet = 'wallet',
  Contract = 'contract',
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
  blockchain: Blockchain;
  network: string;
  address: string;
  publicKey: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface WalletBlockchain {
  id: string;
  blockchain: Blockchain;
  network: string;
  address: string;
  publicKey: string;
}

export interface WalletExchange {
  id: string;
  type: WalletExchangeType;
  payload: string; // decoded json
}

export const walletTableName = 'wallet';
export const walletBlockchainTableName = 'wallet_blockchain';
export const walletExchangeTableName = 'wallet_exchange';

export const walletTableFactory = createTableFactory<Wallet>(walletTableName);
export const walletBlockchainTableFactory = createTableFactory<Wallet>(walletBlockchainTableName);
export const walletExchangeTableFactory = createTableFactory<Wallet>(walletExchangeTableName);

export type WalletTable = ReturnType<ReturnType<typeof walletTableFactory>>;
export type WalletBlockchainTable = ReturnType<ReturnType<typeof walletBlockchainTableFactory>>;
export type WalletExchangeTable = ReturnType<ReturnType<typeof walletExchangeTableFactory>>;
