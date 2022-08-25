import container from '@container';
import {
  contractBlockchainTableName,
  ContractRiskFactor,
  contractTableName,
} from '@models/Protocol/Entity';
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
    .where(`${contractTableName}.id`, id)
    .first();
  if (!contract) {
    throw new Error(`No contract found with id ${id}`);
  }

  const lastMetric = await container.model
    .metricContractRegistryTable()
    .where('contract', contract.id)
    .first();

  if (!lastMetric) {
    throw new Error(`No last metric found for contract`);
  }

  let riskLevel = ContractRiskFactor.notCalculated;
  const currentApy = new BigNumber(lastMetric.data.aprYear ?? '-1');

  if (currentApy.gte(0) && currentApy.lte(20)) {
    riskLevel = ContractRiskFactor.low;
  }

  if (currentApy.gte(21) && currentApy.lte(99)) {
    riskLevel = ContractRiskFactor.moderate;
  }
  if (currentApy.gte(100)) {
    riskLevel = ContractRiskFactor.high;
  }

  await container.model.metricService().createContract(
    contract,
    {
      ...lastMetric.data,
      risk: riskLevel,
    },
    new Date(),
  );

  return process.done();
};
