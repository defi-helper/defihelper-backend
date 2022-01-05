import container from '@container';
import { Process } from '@models/Queue/Entity';

interface Params {
  id: string;
  network: string;
}

export default async (process: Process) => {
  const { id, network } = process.task.params as Params;

  switch (network) {
    case '1285':
      await container.model.queueService().push('metricsWalletBalancesDeBankFiller', {
        id,
      });
      break;

    default:
      await container.model.queueService().push('metricsWalletBalancesMoralisFiller', {
        id,
      });
  }

  return process.done();
};
