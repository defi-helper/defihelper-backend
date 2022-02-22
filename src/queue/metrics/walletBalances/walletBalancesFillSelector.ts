import container from '@container';
import { Process } from '@models/Queue/Entity';

interface Params {
  id: string;
  network: string;
}

export default async (process: Process) => {
  const { id, network } = process.task.params as Params;

  switch (network) {
    default:
      await container.model.queueService().push('metricsWalletBalancesDeBankFiller', {
        id,
      });
  }

  return process.done();
};
