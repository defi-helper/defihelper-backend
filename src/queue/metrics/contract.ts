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
  const adapter = await metricService.getAdapter(protocol);
  if (adapter instanceof Error) throw adapter;
  if (adapter.metrics === undefined) return process.info('Metrics adapter not found').done();

  const metricAdapter = adapter.metrics[contract.adapter];
  if (metricAdapter === undefined) throw new Error('Target metric adapter not found');

  if (metricAdapter.contract === undefined) {
    return process.info('Contract metric adapter not found').done();
  }

  const blockchain = container.blockchain[contract.blockchain];
  if (!blockchain.provider.hasOwnProperty(contract.network)) {
    throw new Error('Network not supported');
  }
  const providerFactory = blockchain.provider[
    contract.network as keyof typeof blockchain.provider
  ] as Factory<any>;

  const metric = await metricAdapter.contract(providerFactory(), contract.address);
  await metricService.createContract(contract, metric);

  return process.done();
};
