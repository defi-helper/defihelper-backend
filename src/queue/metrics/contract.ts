import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Factory } from '@services/Container';
import dayjs from 'dayjs';

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
  if (!blockchain.provider.hasOwnProperty(contract.network)) {
    throw new Error('Network not supported');
  }
  const providerFactory = blockchain.provider[
    contract.network as keyof typeof blockchain.provider
  ] as Factory<any>;
  const provider = providerFactory();

  let date = new Date();
  if (contract.blockchain === 'ethereum' && blockNumber !== 'latest') {
    const block = await provider.getBlock(parseInt(blockNumber, 10));
    date = dayjs.unix(block.timestamp).toDate();
  }

  const contractAdapterData = await contractAdapterFactory(providerFactory(), contract.address, {
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
