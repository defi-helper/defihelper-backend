import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractBlockchainTableName}.blockchain`, 'ethereum')
    .where(`${contractTableName}.layout`, '<>', 'debank');

  const startAt = dayjs().startOf('day').add(8, 'hours').toDate();
  await contracts.reduce<Promise<unknown>>(async (prev, { id }) => {
    await prev;
    return queue.push('metricsPoolRiskRankingFiller', { id }, { startAt });
  }, Promise.resolve(null));

  return process.done();
};
