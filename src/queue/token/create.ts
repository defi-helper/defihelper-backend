import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';

export interface Params {
  blockchain: Blockchain;
  network: string;
  address: string;
}

export default async (process: Process) => {
  const { blockchain, network } = process.task.params as Params;
  let { address } = process.task.params as Params;
  if (blockchain === 'ethereum') {
    address = address.toLowerCase();
  }

  const duplicate = await container.model
    .tokenTable()
    .where({
      blockchain,
      network,
      address,
    })
    .first();
  if (duplicate) return process.info('duplicate').done();

  await container.model.tokenService().create(null, blockchain, network, address, '', '', 0);

  return process.done();
};
