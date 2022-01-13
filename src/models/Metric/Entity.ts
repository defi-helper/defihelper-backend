import { Blockchain } from '@models/types';
import { tableFactory as createTableFactory } from '@services/Database';

export interface MetricMap {
  [k: string]: string;
}

interface Metric {
  id: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export interface MetricBlockchain extends Metric {
  blockchain: Blockchain;
  network: string;
}

export const metricBlockchainTableName = 'metric_blockchain';

export const metricBlockchainTableFactory =
  createTableFactory<MetricBlockchain>(metricBlockchainTableName);

export type MetricBlockchainTable = ReturnType<ReturnType<typeof metricBlockchainTableFactory>>;

export interface MetricProtocol extends Metric {
  protocol: string;
}

export const metricProtocolTableName = 'metric_protocol';

export const metricProtocolTableFactory =
  createTableFactory<MetricProtocol>(metricProtocolTableName);

export type MetricProtocolTable = ReturnType<ReturnType<typeof metricProtocolTableFactory>>;

export type MetricContractField =
  | 'tvl'
  | 'aprDay'
  | 'aprWeek'
  | 'aprMonth'
  | 'aprYear'
  | 'uniqueWalletsCount';

export type MetricContractAPRField = Exclude<MetricContractField, 'tvl' | 'uniqueWalletsCount'>;

export interface MetricContract extends Metric {
  contract: string;
}

export const metricContractTableName = 'metric_contract';

export const metricContractTableFactory =
  createTableFactory<MetricContract>(metricContractTableName);

export type MetricContractTable = ReturnType<ReturnType<typeof metricContractTableFactory>>;

export type MetricWalletField = 'stakingUSD' | 'earnedUSD';

export interface MetricWallet extends Metric {
  contract: string;
  wallet: string;
}

export const metricWalletTableName = 'metric_wallet';

export const metricWalletTableFactory = createTableFactory<MetricWallet>(metricWalletTableName);

export type MetricWalletTable = ReturnType<ReturnType<typeof metricWalletTableFactory>>;

export interface MetricWalletToken extends Metric {
  contract: string | null;
  wallet: string;
  token: string;
}

export const metricWalletTokenTableName = 'metric_wallet_token';

export const metricWalletTokenTableFactory = createTableFactory<MetricWalletToken>(
  metricWalletTokenTableName,
);

export type MetricWalletTokenTable = ReturnType<ReturnType<typeof metricWalletTokenTableFactory>>;
