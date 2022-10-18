import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const tokens = await container.model.tokenTable().whereNotNull('coingeckoId');

  await tokens.reduce<Promise<any>>(async (prev, { id }) => {
    await prev;
    return queue.push('metricsTokenRiskRankingFiller', { id });
  }, Promise.resolve());

  return process.done();
};
