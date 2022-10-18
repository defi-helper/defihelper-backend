import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model.contractBlockchainTable();

  await Promise.all(
    contracts.map((contract) => queue.push('riskCalculationFiller', { id: contract.id })),
  );

  return process.done();
};
