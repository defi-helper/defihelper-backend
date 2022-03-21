import container from '@container';
import { Process } from '@models/Queue/Entity';
import { WalletExchangeType } from '@models/Wallet/Entity';

interface Params {
  id: string;
  exchange: keyof WalletExchangeType;
}

export default async (process: Process) => {
  const { id, exchange } = process.task.params as Params;

  switch (exchange) {
    default:
      await container.model.queueService().push('metricsWalletBalancesCexUniversalFiller', {
        id,
      });
  }

  return process.done();
};
