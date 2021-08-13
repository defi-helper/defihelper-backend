import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';

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
  const blockchain = container.blockchain[contract.blockchain];
  const { provider: providerFactory, avgBlockTime } = blockchain.byNetwork(contract.network);
  const provider = providerFactory();

  const startBlockNumber = contract.deployBlockNumber;
  if (startBlockNumber === '0' || startBlockNumber === null) {
    return process.info('No deploy block number').done();
  }

  const currentBlockNumber = await provider.getBlockNumber();
  const step = new BN(60)
    .div(avgBlockTime)
    .multipliedBy(60 * 24)
    .div(2)
    .toFixed(0); // ~2 metrics by day

  const queue = container.model.queueService();
  let blockNumber = new BN(startBlockNumber);
  while (blockNumber.lt(currentBlockNumber)) {
    queue.push('metricsContractBlock', {
      contract: contract.id,
      blockNumber: blockNumber.toFixed(0),
    });

    blockNumber = new BN(blockNumber).plus(step);
  }

  return process.done();
};
