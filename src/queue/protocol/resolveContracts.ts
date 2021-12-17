import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  protocolId: string;
  protocolBlockchain: 'ethereum' | 'waves';
  protocolNetwork: string;
}

export default async (process: Process) => {
  const { protocolId, protocolBlockchain, protocolNetwork } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const protocolAdapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);
  const protocolDefaultResolver = protocolAdapters.default;

  if (typeof protocolDefaultResolver !== 'function') {
    throw new Error('Adapter have no pools resolver, u should implement it first');
  }


  const blockchain = container.blockchain[protocolBlockchain];
  const network = blockchain.byNetwork(protocolNetwork);

  const pools = protocolDefaultResolver(network.provider());

  // return process.done();
};
