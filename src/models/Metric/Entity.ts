import { tableFactory as createTableFactory } from '@services/Database';

export interface MetricItem {
  type: string;
  value: string;
}

export interface MetricMap {
  [k: string]: MetricItem;
}

export interface MetricContract {
  id: string;
  contract: string;
  data: MetricMap;
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
  createdAt: Date;
}

export const metricWalletTableName = 'metric_wallet';

export const metricWalletTableFactory = createTableFactory<MetricWallet>(metricWalletTableName);

export type MetricWalletTable = ReturnType<ReturnType<typeof metricWalletTableFactory>>;
