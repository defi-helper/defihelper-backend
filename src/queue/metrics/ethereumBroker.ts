import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  Object.values(container.blockchain.ethereum.networks).map((network) => {
    if (network.testnet || !network.hasProvider) return null;

    return queue.push('metricsEthereumCurrent', { network: network.id });
  });

  return process.done();
};
