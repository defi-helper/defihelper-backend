import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';

export interface Params {
  blockchain: Blockchain;
  network: string;
  address: string;
}

export default async (process: Process) => {
  const { blockchain, network, address } = process.task.params as Params;

  await container.model.tokenService().create(null, blockchain, network, address, '', '', 0);

  return process.done();
};
