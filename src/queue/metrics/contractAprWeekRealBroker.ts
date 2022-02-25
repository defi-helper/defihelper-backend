import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model
    .contractTable()
    .where('hidden', false)
    .andWhere('protocol', 'c099eeec-1a60-4b62-98e0-2fbc4c958699'); // for test
  await Promise.all(
    contracts.map((contract) =>
      queue.push(
        'metricsContractAprWeekReal',
        { contract: contract.id, period: 7, investing: 10000 },
        { topic: 'metricHistory' },
      ),
    ),
  );

  return process.done();
};
