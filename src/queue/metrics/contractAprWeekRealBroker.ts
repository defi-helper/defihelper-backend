import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model.contractTable().where('hidden', false);
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
