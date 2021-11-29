import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export interface Params {
  contract: string;
  events?: string[];
}

export default async (process: Process) => {
  const { contract: contractId, events } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  if (contract.blockchain !== 'ethereum') return process.done();
  if (contract.deployBlockNumber === null) {
    await container.model.queueService().push(
      'contractResolveDeployBlockNumber',
      { contract: contract.id },
      {
        collisionSign: `contractResolveDeployBlockNumber:${contract.id}`,
      },
    );
    return process.later(dayjs().add(300, 'seconds').toDate());
  }

  await container.model
    .queueService()
    .push('registerContractInScanner', { contract: contract.id, events });

  await container.model.queueService().push('metricsContractCurrent', { contract: contract.id });

  if (['1', '56'].includes(contract.network)) {
    container.model.queueService().push('metricsContractHistory', { contract: contract.id });
    container.model.queueService().push(
      'metricsContractScannerHistory',
      { contract: contract.id },
      {
        startAt: dayjs().add(10, 'minutes').toDate(),
      },
    );
  }

  return process.done();
};
