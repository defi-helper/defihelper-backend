import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

export interface Params {
  contract: string;
  blockNumber: string;
}

export default async (process: Process) => {
  const { contract: contractId, blockNumber } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const metricService = container.model.metricService();
  const protocolAdapters = await metricService.getAdapter(protocol);
  const contractAdapterFactory = protocolAdapters[contract.adapter];
  if (contractAdapterFactory === undefined) throw new Error('Contract adapter not found');

  const blockchain = container.blockchain[contract.blockchain];
  const provider = blockchain.byNetwork(contract.network).provider();

  let date = new Date();
  if (provider instanceof ethers.providers.JsonRpcProvider && blockNumber !== 'latest') {
    const block = await provider.getBlock(parseInt(blockNumber, 10));
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(provider, contract.address, {
    blockNumber,
  });
  if (
    typeof contractAdapterData.metrics === 'object' &&
    Object.keys(contractAdapterData.metrics).length > 0
  ) {
    await metricService.createContract(contract, contractAdapterData.metrics, date);
  }

  return process.done();
};
