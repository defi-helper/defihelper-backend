import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');
  if (contract.blockchain !== 'ethereum') {
    return process.info('No ethereum').done();
  }
  const provider = container.blockchain[contract.blockchain].byNetwork(contract.network).provider();

  const startBlockNumber = contract.deployBlockNumber;
  if (startBlockNumber === '0' || startBlockNumber === null) {
    return process.info('No deploy block number').done();
  }
  const startBlock = await provider.getBlock(parseInt(startBlockNumber, 10));

  const queue = container.model.queueService();
  const currentMonth = dayjs().startOf('month');
  let startDate = dayjs.unix(startBlock.timestamp).startOf('month');
  while (startDate.isBefore(currentMonth)) {
    const endDate = startDate.clone().add(1, 'month').startOf('month');
    queue.push('metricsContractScannerDate', {
      contract: contract.id,
      date: {
        from: startDate.unix(),
        to: endDate.unix(),
      },
    });

    startDate = endDate;
  }

  return process.done();
};
