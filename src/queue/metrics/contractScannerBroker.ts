import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model.contractTable().where('blockchain', 'ethereum');
  await Promise.all(
    contracts.map((contract) =>
      queue.push('metricsContractScannerDate', { contract: contract.id }),
    ),
  );

  return process.done();
};
