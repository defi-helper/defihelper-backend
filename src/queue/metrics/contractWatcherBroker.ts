import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractBlockchainTableName}.blockchain`, 'ethereum');
  await Promise.all(
    contracts.map((contract) =>
      queue.push('metricsContractWatcherDate', { contract: contract.id }),
    ),
  );

  return process.done();
};
