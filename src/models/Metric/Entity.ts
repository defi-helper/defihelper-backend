import { Blockchain } from '@models/types';
import { tableFactoryLegacy } from '@services/Database';
import Knex from 'knex';

export interface MetricMap {
  [k: string]: string;
}

export interface Metric {
  id: string;
  data: MetricMap;
  date: Date;
  createdAt: Date;
}

export interface Registry {
  id: string;
  data: MetricMap;
  date: Date;
}

export namespace QueryModify {
  export function lastValue<T extends Metric>(
    query: Knex.QueryBuilder<T, T[]>,
    byFields: string[],
  ) {
    query
      .distinctOn(...byFields)
      .orderBy(byFields)
      .orderBy('date', 'desc');
  }

  export function sumMetric(query: Knex.QueryBuilder, field: string | [string, string]) {
    const [alias, fieldName] = Array.isArray(field) ? field : [null, field];
    query.column(
      query.client.raw(
        `SUM((COALESCE(${fieldName}, '0'))::numeric)${alias ? ` AS "${alias}"` : ''}`,
      ),
    );
  }
}

export interface MetricBlockchain extends Metric {
  blockchain: Blockchain;
  network: string;
}

export const metricBlockchainTableName = 'metric_blockchain';

export const metricBlockchainTableFactory =
  tableFactoryLegacy<MetricBlockchain>(metricBlockchainTableName);

export type MetricBlockchainTable = ReturnType<ReturnType<typeof metricBlockchainTableFactory>>;

export interface MetricProtocol extends Metric {
  protocol: string;
}

export const metricProtocolTableName = 'metric_protocol';

export const metricProtocolTableFactory =
  tableFactoryLegacy<MetricProtocol>(metricProtocolTableName);

export type MetricProtocolTable = ReturnType<ReturnType<typeof metricProtocolTableFactory>>;

export type MetricContractField =
  | 'tvl'
  | 'aprDay'
  | 'aprWeek'
  | 'aprMonth'
  | 'aprYear'
  | 'uniqueWalletsCount'
  | 'risk';

export type MetricContractAPRField = Exclude<
  MetricContractField,
  'tvl' | 'uniqueWalletsCount' | 'risk'
>;

export interface MetricContract extends Metric {
  contract: string;
}

export const metricContractTableName = 'metric_contract';

export const metricContractTableFactory =
  tableFactoryLegacy<MetricContract>(metricContractTableName);

export type MetricContractTable = ReturnType<ReturnType<typeof metricContractTableFactory>>;

export interface MetricContractTask {
  id: string;
  contract: string;
  task: string;
  createdAt: Date;
}

export const metricContractTaskTableName = 'metric_contract_task';

export const metricContractTaskTableFactory = tableFactoryLegacy<MetricContractTask>(
  metricContractTaskTableName,
);

export type MetricContractTaskTable = ReturnType<ReturnType<typeof metricContractTaskTableFactory>>;

export type MetricWalletField = 'stakingUSD' | 'earnedUSD';

export interface MetricWallet extends Metric {
  contract: string;
  wallet: string;
}

export const metricWalletTableName = 'metric_wallet';

export const metricWalletTableFactory = tableFactoryLegacy<MetricWallet>(metricWalletTableName);

export type MetricWalletTable = ReturnType<ReturnType<typeof metricWalletTableFactory>>;

export interface MetricWalletRegistry extends Registry {
  contract: string;
  wallet: string;
}

export const metricWalletRegistryTableName = 'metric_wallet_registry';

export const metricWalletRegistryTableFactory = tableFactoryLegacy<MetricWalletRegistry>(
  metricWalletRegistryTableName,
);

export type MetricWalletRegistryTable = ReturnType<
  ReturnType<typeof metricWalletRegistryTableFactory>
>;

export interface MetricWalletTask {
  id: string;
  contract: string;
  wallet: string;
  task: string;
  createdAt: Date;
}

export const metricWalletTaskTableName = 'metric_wallet_task';

export const metricWalletTaskTableFactory =
  tableFactoryLegacy<MetricWalletTask>(metricWalletTaskTableName);

export type MetricWalletTaskTable = ReturnType<ReturnType<typeof metricWalletTaskTableFactory>>;

export interface MetricWalletToken extends Metric {
  contract: string | null;
  wallet: string;
  token: string;
}

export const metricWalletTokenTableName = 'metric_wallet_token';

export const metricWalletTokenTableFactory = tableFactoryLegacy<MetricWalletToken>(
  metricWalletTokenTableName,
);

export type MetricWalletTokenTable = ReturnType<ReturnType<typeof metricWalletTokenTableFactory>>;

export interface MetricWalletTokenRegistry extends Registry {
  contract: string | null;
  wallet: string;
  token: string;
}

export const metricWalletTokenRegistryTableName = 'metric_wallet_token_registry';

export const metricWalletTokenRegistryTableFactory = tableFactoryLegacy<MetricWalletTokenRegistry>(
  metricWalletTokenRegistryTableName,
);

export type MetricWalletTokenRegistryTable = ReturnType<
  ReturnType<typeof metricWalletTokenRegistryTableFactory>
>;

export interface MetricContractRegistry extends Registry {
  contract: string;
}

export const metricContractRegistryTableName = 'metric_contract_registry';

export const metricContractRegistryTableFactory = tableFactoryLegacy<MetricContractRegistry>(
  metricContractRegistryTableName,
);

export type MetricContractRegistryTable = ReturnType<
  ReturnType<typeof metricContractRegistryTableFactory>
>;

export interface MetricToken extends Metric {
  token: string;
}

export const metricTokenTableName = 'metric_token';

export const metricTokenTableFactory = tableFactoryLegacy<MetricToken>(metricTokenTableName);

export type MetricTokenTable = ReturnType<ReturnType<typeof metricTokenTableFactory>>;
