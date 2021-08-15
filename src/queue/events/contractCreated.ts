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
        colissionSign: `contractResolveDeployBlockNumber:${contract.id}`,
      },
    );
    return process.later(dayjs().add(30, 'seconds').toDate());
  }

  await container.model
    .queueService()
    .push('registerContractInScanner', { contract: contract.id, events });
  if (contract.network === '1') {
    await container.model.queueService().push('metricsContractHistory', { contract: contract.id });
  }

  return process.done();
};
