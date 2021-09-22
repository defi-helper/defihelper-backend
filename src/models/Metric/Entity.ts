import { Blockchain } from '@models/types';
import { tableFactory as createTableFactory } from '@services/Database';

export interface MetricMap {
  [k: string]: string;
}

export interface MetricBlockchain {
  id: string;
  blockchain: Blockchain;
  network: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export const metricBlockchainTableName = 'metric_blockchain';

export const metricBlockchainTableFactory =
  createTableFactory<MetricBlockchain>(metricBlockchainTableName);

export type MetricBlockchainTable = ReturnType<ReturnType<typeof metricBlockchainTableFactory>>;

export interface MetricContract {
  id: string;
  contract: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export const metricContractTableName = 'metric_contract';

export const metricContractTableFactory =
  createTableFactory<MetricContract>(metricContractTableName);

export type MetricContractTable = ReturnType<ReturnType<typeof metricContractTableFactory>>;

export interface MetricWallet {
  id: string;
  contract: string;
  wallet: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export const metricWalletTableName = 'metric_wallet';

export const metricWalletTableFactory = createTableFactory<MetricWallet>(metricWalletTableName);

export type MetricWalletTable = ReturnType<ReturnType<typeof metricWalletTableFactory>>;

export interface MetricWalletToken {
  id: string;
  contract: string;
  wallet: string;
  token: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export const metricWalletTokenTableName = 'metric_wallet_token';

export const metricWalletTokenTableFactory = createTableFactory<MetricWalletToken>(
  metricWalletTokenTableName,
);

export type MetricWalletTokenTable = ReturnType<ReturnType<typeof metricWalletTokenTableFactory>>;
