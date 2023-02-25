import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();

  await Promise.all([
    queue.push('automateContractStopLossBroker'),
    queue.push('smartTradeOrderCheckBroker'),
    queue.push('metricsUni3RebalanceBroker'),
  ]);

  return process.done();
};
