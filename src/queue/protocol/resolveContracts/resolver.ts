import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', id).first();
  if (!protocol) throw new Error('Protocol not found');

  const protocolAdapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);

  return process.info(JSON.stringify(protocolAdapters)).done();

  // const contractAdapterFactory = protocolAdapters[contract.adapter];
  // if (typeof contractAdapterFactory !== 'function') throw new Error('Contract adapter not found');

  // return process.done();
};
