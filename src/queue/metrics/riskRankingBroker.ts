import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const tokens = await container.model.tokenTable().whereNotNull('coingeckoId');

  await Promise.all(tokens.map(({ id }) => queue.push('metricsRiskRankingFiller', { id })));

  return process.done();
};
