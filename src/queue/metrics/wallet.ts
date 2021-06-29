import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Factory } from '@services/Container';

export interface Params {
  contract: string;
  wallet: string;
}

export default async (process: Process) => {
  const { contract: contractId, wallet: walletId } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');

  const wallet = await container.model.walletTable().where('id', walletId).first();
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.blockchain !== contract.blockchain || wallet.network !== contract.network) {
    throw new Error('Invalid blockchain');
  }

  const metricService = container.model.metricService();
  const adapter = await metricService.getAdapter(protocol);
  if (adapter instanceof Error) throw adapter;
  if (adapter.metrics === undefined) return process.info('Metrics adapter not found').done();

  const metricAdapter = adapter.metrics[contract.adapter];
  if (metricAdapter === undefined) throw new Error('Target metric adapter not found');

  if (metricAdapter.wallet === undefined) {
    return process.info('Wallet metric adapter not found').done();
  }

  const blockchain = container.blockchain[contract.blockchain];
  if (!blockchain.provider.hasOwnProperty(contract.network)) {
    throw new Error('Network not supported');
  }
  const providerFactory = blockchain.provider[
    contract.network as keyof typeof blockchain.provider
  ] as Factory<any>;

  const metric = await metricAdapter.wallet(providerFactory(), contract.address, wallet.address);
  await metricService.createWallet(contract, wallet, metric);
  
  return process.done();
};
