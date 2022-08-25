import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import BigNumber from 'bignumber.js';

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
    .where('id', id)
    .first();
  if (!contract) {
    throw new Error(`No contract found with id ${id}`);
  }

  let riskLevel = 0;
  const currentApy = new BigNumber(contract.metric.aprYear ?? '-1');

  if (currentApy.gte(0) && currentApy.lte(20)) {
    riskLevel = 1;
  }

  if (currentApy.gte(21) && currentApy.lte(99)) {
    riskLevel = 2;
  }
  if (currentApy.gte(100)) {
    riskLevel = 3;
  }

  await container.model.metricService().createContract(
    contract,
    {
      ...contract.metric,
      risk: riskLevel.toString(10),
    },
    new Date(),
  );

  return process.done();
};
