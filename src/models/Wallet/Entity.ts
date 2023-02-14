import { typedTableFactory } from '@services/Database';
import { Blockchain as BlockchainType } from '@models/types';

export enum WalletSuspenseReason {
  LowFunds = 'lowFunds',
  CexUnableToAuthorize = 'cexUnableToAuthorize',
}

export interface Wallet {
  id: string;
  user: string;
  name: string;
  suspendReason: WalletSuspenseReason | null;
  statisticsCollectedAt: Date;
  deletedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export enum WalletBlockchainType {
  Wallet = 'wallet',
  Contract = 'contract',
}

export interface WalletBlockchain {
  id: string;
  type: WalletBlockchainType;
  blockchain: BlockchainType;
  network: string;
  address: string;
  publicKey: string;
  confirmed: boolean;
}

export enum WalletExchangeType {
  Binance = 'binance',
  Huobi = 'huobi',
  Okex = 'okex',
  Ascendex = 'ascendex',
  Mexc = 'mexc',
  Bitmart = 'bitmart',
  Coinex = 'coinex',
  Poloniex = 'poloniex',
  BinanceUS = 'binanceus',
  Bybit = 'bybit',
  Lbank = 'lbank',
  GateIO = 'gateio',
}

export interface WalletExchange {
  id: string;
  exchange: WalletExchangeType;
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
