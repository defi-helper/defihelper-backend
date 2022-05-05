import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model
    .contractTable()
    .innerJoin(contractBlockchainTableName, `${contractTableName}.id`, `${contractTableName}.id`)
    .andWhere(`${contractTableName}.deprecated`, false);
  await Promise.all(
    contracts.map((contract) =>
      queue.push('metricsContractCurrent', { contract: contract.id }, { topic: 'metricCurrent' }),
    ),
  );

  return process.done();
};
