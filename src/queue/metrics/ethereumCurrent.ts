import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  network: string;
}

export default async (process: Process) => {
  const { network } = process.task.params as Params;
  const provider = container.blockchain.ethereum.byNetwork(network).provider();
  const gasPrice = await provider.getGasPrice();

  await container.model
    .metricService()
    .createBlockchain('ethereum', network, { gasPrice: gasPrice.toString() }, new Date());

  return process.done();
};
