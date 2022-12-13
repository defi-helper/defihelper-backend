import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  MetricWalletRegistry,
  metricWalletRegistryTableName,
  MetricWalletTokenRegistry,
  metricWalletTokenRegistryTableName,
  RegistryPeriod,
} from '@models/Metric/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (process: Process) => {
  const [walletCandidates, walletTokenCandidates] = await Promise.all([
    container.model
      .metricWalletRegistryTable()
      .column<Array<MetricWalletRegistry>>(`${metricWalletRegistryTableName}.*`)
      .innerJoin(
        walletTableName,
        `${metricWalletRegistryTableName}.wallet`,
        `${walletTableName}.id`,
      )
      .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
      .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereRaw(
        `${metricWalletRegistryTableName}.date < CURRENT_DATE  - interval '2 days' and coalesce(${metricWalletRegistryTableName}.data->>'stakingUSD', '0')::numeric > 0`,
      )
      .where(`${userTableName}.isMetricsTracked`, true),
    container.model
      .metricWalletTokenRegistryTable()
      .column<Array<MetricWalletTokenRegistry>>(`${metricWalletTokenRegistryTableName}.*`)
      .innerJoin(
        walletTableName,
        `${metricWalletTokenRegistryTableName}.wallet`,
        `${walletTableName}.id`,
      )
      .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
      .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereRaw(
        `${metricWalletTokenRegistryTableName}.date < CURRENT_DATE  - interval '2 days' and coalesce(${metricWalletTokenRegistryTableName}.data->>'balance', '0')::numeric > 0`,
      )
      .where(`${userTableName}.isMetricsTracked`, true),
  ]);

  const metricService = container.model.metricService();
  await Promise.all([
    walletCandidates.reduce<Promise<unknown>>(async (prev, metric) => {
      await prev;

      const [contract, wallet] = await Promise.all([
        container.model.contractTable().where('id', metric.contract).first(),
        container.model.walletTable().where('id', metric.wallet).first(),
      ]);
      if (!contract || !wallet) {
        return null;
      }

      return metricService.createWallet(
        contract,
        wallet,
        {
          earned: '0',
          staking: '0',
          earnedUSD: '0',
          stakingUSD: '0',
        },
        new Date(),
      );
    }, Promise.resolve(null)),
    walletTokenCandidates.reduce<Promise<unknown>>(async (prev, metric) => {
      await prev;

      const [contract, wallet, token] = await Promise.all([
        metric.contract
          ? container.model.contractTable().where('id', metric.contract).first()
          : null,
        container.model.walletTable().where('id', metric.wallet).first(),
        container.model.tokenTable().where('id', metric.token).first(),
      ]);
      if (contract === undefined || !wallet || !token) {
        return null;
      }

      return metricService.createWalletToken(
        contract,
        wallet,
        token,
        {
          usd: '0',
          balance: '0',
        },
        new Date(),
      );
    }, Promise.resolve(null)),
  ]);

  return process.done();
};
