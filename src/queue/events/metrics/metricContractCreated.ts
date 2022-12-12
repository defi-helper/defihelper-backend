import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const metric = await container.model.metricContractTable().where('id', id).first();

  if (!metric) {
    throw new Error('Metric now found');
  }
  const { aprYear } = metric.data;
  if (!aprYear) {
    return process.done();
  }

  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, metric.contract)
    .first();
  if (!contract || contract.blockchain !== 'ethereum') {
    return process.done();
  }

  if (new BN(aprYear).isZero() || !contract.hidden) {
    return process.done();
  }

  await container.model.contractService().updateBlockchain({
    ...contract,
    hidden: false,
  });
  return process.done();
};
