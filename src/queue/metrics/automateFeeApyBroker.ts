import {
  contractTableName,
  investHistoryTableName,
  ContractType,
  ContractVerificationStatus,
} from '@models/Automate/Entity';
import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const investQuery = container.model
    .automateInvestHistoryTable()
    .count('id')
    .where('refunded', false)
    .where('confirmed', true)
    .whereRaw(`${investHistoryTableName}.contract = ${contractTableName}.id`)
    .toQuery();
  const automates = await container.model
    .automateContractTable()
    .where('type', ContractType.Autorestake)
    .where('verification', ContractVerificationStatus.Confirmed)
    .whereNull('archivedAt')
    .whereRaw(`(${investQuery}) > 0`);

  const queue = container.model.queueService();
  const lag = 3600 / automates.length; // 1 hours
  await automates.reduce<Promise<dayjs.Dayjs>>(async (prev, { id }) => {
    const startAt = await prev;

    await queue.push(
      'metricsAutomateFeeApy',
      { id },
      { topic: 'metricCurrent', startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
