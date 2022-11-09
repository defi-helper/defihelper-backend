import container from '@container';
import { metricWalletRegistryTableName } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (process: Process) => {
  const candidatesCount = await container.model
    .metricWalletRegistryTable()
    .column(container.database().raw(`count(${metricWalletRegistryTableName}.id)`))
    .innerJoin(walletTableName, `${metricWalletRegistryTableName}.wallet`, `${walletTableName}.id`)
    .innerJoin(userTableName, `${userTableName}.id`, `${walletTableName}.user`)
    .whereRaw(
      `date < CURRENT_DATE  - interval '2 days' and coalesce(data->>'stakingUSD', '0')::numeric > 0`,
    )
    .andWhere('isMetricsTracked', true);

  if (!candidatesCount.length) {
    throw new Error('no rows found');
  }

  const number = candidatesCount[0]?.count ?? 0;
  container
    .telegram()
    .send(
      'log',
      { source: 'stucked wallet metrics', message: number },
      container.parent.log.chatId,
    );

  return process.done();
};
