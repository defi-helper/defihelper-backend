import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Factory } from '@services/Container';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;
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

  const contractAdapterData = await contractAdapterFactory(providerFactory(), contract.address);
  if (!contractAdapterData.metrics) return process.done();

  const metrics = contractAdapterData.metrics;
  await metricService.createContract(contract, metrics, new Date());

  return process.done();
};
