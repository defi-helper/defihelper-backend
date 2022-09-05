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
  const currentApy = new BigNumber(lastMetric.data.aprYear ?? '-1').multipliedBy(100);
  const currentTvl = new BigNumber(lastMetric.data.tvl ?? '0');

  if (currentApy.gt(0) && currentApy.lt(20)) {
    if (currentTvl.gte(100_000)) {
      riskLevel = ContractRiskFactor.low;
    } else {
      riskLevel = ContractRiskFactor.moderate;
    }
  }

  if (currentApy.gte(20) && currentApy.lt(100)) {
    riskLevel = ContractRiskFactor.moderate;
  }
  if (currentApy.gte(100)) {
    riskLevel = ContractRiskFactor.high;
  }

  await Promise.all([
    container.model.metricService().createContract(
      contract,
      {
        ...lastMetric.data,
        risk: riskLevel,
      },
      new Date(),
    ),

    container.model.contractService().updateBlockchain({
      ...contract,
      metric: {
        ...lastMetric.data,
        risk: riskLevel,
      },
    }),
  ]);

  return process.done();
};
