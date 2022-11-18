import container from '@container';
import {
  metricWalletRegistryTableName,
  metricWalletTokenRegistryTableName,
  RegistryPeriod,
} from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (process: Process) => {
  const [walletCandidatesCount, walletTokenCandidatesCount] = await Promise.all([
    container.model
      .metricWalletRegistryTable()
      .count()
      .innerJoin(
        walletTableName,
        `${metricWalletRegistryTableName}.wallet`,
        `${walletTableName}.id`,
      )
      .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
      .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereRaw(
        `date < CURRENT_DATE  - interval '2 days' and coalesce(data->>'stakingUSD', '0')::numeric > 0`,
      )
      .andWhere('isMetricsTracked', true)
      .first()
      .then((row) => row?.count ?? '0'),
    container.model
      .metricWalletTokenRegistryTable()
      .count()
      .innerJoin(
        walletTableName,
        `${metricWalletTokenRegistryTableName}.wallet`,
        `${walletTableName}.id`,
      )
      .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
      .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereRaw(
        `date < CURRENT_DATE  - interval '2 days' and coalesce(data->>'balance', '0')::numeric > 0`,
      )
      .andWhere('isMetricsTracked', true)
      .first()
      .then((row) => row?.count ?? '0'),
  ]);

  container.telegram().send(
    'log',
    {
      source: 'Stucked metrics',
      message: `metricWallet: ${walletCandidatesCount}, metricWalletToken: ${walletTokenCandidatesCount}`,
    },
    container.parent.log.chatId,
  );

  return process.done();
};
