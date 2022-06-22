import container from '@container';
import { Process } from '@models/Queue/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;
  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();
  if (!contract) throw new Error('Contract not found');

  // Disable deprecated contracts on watcher
  if (contract.watcherId) {
    await container.scanner().updateContract(contract.watcherId, { enabled: !contract.deprecated });
  }

  return process.done();
};
