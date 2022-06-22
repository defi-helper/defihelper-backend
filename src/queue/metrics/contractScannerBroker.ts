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
    .where(`${contractBlockchainTableName}.blockchain`, 'ethereum')
    .whereNotNull(`${contractBlockchainTableName}.watcherId`);
  await Promise.all(
    contracts.map((contract) =>
      queue.push('metricsContractScannerDate', { contract: contract.id }),
    ),
  );

  return process.done();
};
