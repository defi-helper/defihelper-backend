import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model.contractBlockchainTable().where('blockchain', 'ethereum');

  await contracts.reduce<Promise<any>>(async (prev, { id }) => {
    await prev;
    return queue.push('metricsPoolRiskRankingFiller', { id });
  }, Promise.resolve());

  return process.done();
};
