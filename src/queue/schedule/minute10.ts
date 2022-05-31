import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();

  const networks = Object.keys(container.blockchain.ethereum.networks).map((network) =>
    queue.push('metricsEthereumCurrent', { network }),
  );

  await Promise.all([
    ...networks,
    queue.push('emptyWalletsBroker'),
    queue.push('logBilling'),
    queue.push('logPriceResolver'),
    queue.push('regularContractsWalletLink'),
  ]);

  return process.done();
};
