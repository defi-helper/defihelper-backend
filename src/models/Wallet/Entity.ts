import { tableFactory as createTableFactory } from '@services/Database';
import { Blockchain as BlockchainType } from '@models/types';

export enum WalletType {
  Wallet = 'wallet',
  Contract = 'contract',
}

export type WalletValues<T extends WalletSource> = T extends WalletSource.Blockchain
  ? Omit<WalletBlockchain, 'id'>
  : T extends WalletSource.Exchange
  ? Omit<WalletExchange, 'id'>
  : never;

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
  blockchain: BlockchainType;
  network: string;
  address: string;
  publicKey: string;
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
  payload: string; // decoded json
}

export const walletTableName = 'wallet';
export const walletBlockchainTableName = 'wallet_blockchain';
export const walletExchangeTableName = 'wallet_exchange';

export const walletTableFactory = createTableFactory<Wallet>(walletTableName);
export const walletBlockchainTableFactory =
  createTableFactory<WalletBlockchain>(walletBlockchainTableName);
export const walletExchangeTableFactory =
  createTableFactory<WalletExchange>(walletExchangeTableName);

export type WalletTable = ReturnType<ReturnType<typeof walletTableFactory>>;
export type WalletBlockchainTable = ReturnType<ReturnType<typeof walletBlockchainTableFactory>>;
export type WalletExchangeTable = ReturnType<ReturnType<typeof walletExchangeTableFactory>>;
