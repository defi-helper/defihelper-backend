import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export interface Params {
  txId?: string;
  contract: string;
  wallet: string;
}

export default async (process: Process) => {
  const { txId, contract: contractId, wallet: walletId } = process.task.params as Params;

  if (typeof txId === 'string') {
    const contract = await container.model
      .contractBlockchainTable()
      .where('id', contractId)
      .first();
    if (!contract) throw new Error('Contract not found');
    if (contract.blockchain !== 'ethereum') {
      return process.info('No ethereum').done();
    }
    const provider = container.blockchain.ethereum.byNetwork(contract.network).provider();
    try {
      await provider.waitForTransaction(txId, 1, 10000); // 10 seconds
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('timeout exceeded')) {
        // Later call if timeout
        return process.later(dayjs().add(1, 'minutes').toDate());
      }
      throw e;
    }
  }

  await container.model.queueService().push(
    'metricsWalletCurrent',
    {
      contract: contractId,
      wallet: walletId,
    },
    {
      topic: 'metricCurrent',
      priority: 9,
    },
  );

  return process.done();
};
