import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Factory } from '@services/Container';
import bn from 'bignumber.js';

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
  if (!blockchain.provider.hasOwnProperty(contract.network)) {
    throw new Error('Network not supported');
  }
  const network = contract.network as keyof typeof blockchain.provider;
  const providerFactory = blockchain.provider[network] as Factory<any>;
  const provider = providerFactory();

  const startBlockNumber = contract.deployBlockNumber;
  if (startBlockNumber === '0' || startBlockNumber === null) {
    return process.info('No deploy block number').done();
  }

  const currentBlockNumber = await provider.getBlockNumber();
  const avgBlockTime = blockchain.avgBlockTime[network];
  const step = new bn(60)
    .div(avgBlockTime)
    .multipliedBy(60 * 24)
    .div(2)
    .toFixed(0); // ~2 metrics by day

  const queue = container.model.queueService();
  let blockNumber = new bn(startBlockNumber);
  while (blockNumber.lt(currentBlockNumber)) {
    queue.push('metricsContract', {
      contract: contract.id,
      blockNumber: blockNumber.toFixed(0),
    });

    blockNumber = new bn(blockNumber).plus(step);
  }

  return process.done();
};
