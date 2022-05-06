import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all([
    queue.push('metricsEthereumCurrent', { network: '1' }),
    queue.push('metricsEthereumCurrent', { network: '3' }),
    queue.push('metricsEthereumCurrent', { network: '56' }),
    queue.push('emptyWalletsBroker'),
    queue.push('logBilling'),
    queue.push('logPriceResolver'),
    queue.push('regularContractsWalletLink'),
  ]);

  return process.done();
};
