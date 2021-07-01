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
  const protocolAdapter = await metricService.getAdapter(protocol);
  const contractAdapterFactory = protocolAdapter[contract.adapter];
  if (contractAdapterFactory === undefined) throw new Error('Contract adapter not found');

  const blockchain = container.blockchain[contract.blockchain];
  if (!blockchain.provider.hasOwnProperty(contract.network)) {
    throw new Error('Network not supported');
  }
  const providerFactory = blockchain.provider[
    contract.network as keyof typeof blockchain.provider
  ] as Factory<any>;

  const contractAdapterData = await contractAdapterFactory(providerFactory(), contract.address);
  if (!contractAdapterData.wallet) return process.done();

  const walletAdapterData = await contractAdapterData.wallet(wallet.address);
  if (!walletAdapterData.metrics) return process.done();
  await metricService.createWallet(contract, wallet, walletAdapterData.metrics, new Date());

  if (!walletAdapterData.tokens) return process.done();
  await Promise.all(
    Object.entries(walletAdapterData.tokens).map(([token, metric]) =>
      metricService.createToken(contract, wallet, token, metric, new Date()),
    ),
  );

  return process.done();
};
