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

  const lag = 28800 / contracts.length;
  await contracts.reduce<Promise<dayjs.Dayjs>>(async (prev, { id }) => {
    const startAt = await prev;
    await queue.push('metricsPoolRiskRankingFiller', { id }, { startAt: startAt.toDate() });

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
