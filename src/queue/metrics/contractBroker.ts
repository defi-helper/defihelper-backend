import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model.contractTable();
  await Promise.all(
    contracts.map((contract) => queue.push('metricsContract', { contract: contract.id })),
  );

  return process.done();
};
