import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where('id', id)
    .first();
  if (!wallet) throw new Error('Wallet not found');

  if (wallet.blockchain !== 'ethereum') {
    return process.done();
  }

  await Promise.all([
    container.model.queueService().push(
      'findWalletAppliedNetworks',
      {
        walletId: wallet.id,
      },
      { topic: 'metricCurrent' },
    ),
    container.model.queueService().push('findWalletContracts', {
      walletId: wallet.id,
    }),
    container.model.queueService().push(
      'metricsWalletBalancesFillSelector',
      {
        id: wallet.id,
        network: wallet.network,
      },
      { topic: 'metricCurrent' },
    ),
  ]);

  return process.done();
};
