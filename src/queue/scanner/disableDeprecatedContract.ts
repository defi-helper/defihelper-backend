import container from '@container';
import { Process } from '@models/Queue/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, id)
    .first();
  if (!contract) throw new Error('Contract not found');
  if (!contract.watcherId) return process.done();

  await container.scanner().updateContract(contract.watcherId, { enabled: !contract.deprecated });

  return process.done();
};
