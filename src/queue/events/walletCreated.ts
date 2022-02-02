import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
    .first();
  if (!blockchainWallet) throw new Error('Wallet not found');

  if (blockchainWallet.blockchain !== 'ethereum') {
    return process.done();
  }

  await Promise.all([
    container.model.queueService().push(
      'findWalletAppliedNetworks',
      {
        walletId: blockchainWallet.id,
      },
      { topic: 'metricCurrent' },
    ),
    container.model.queueService().push('findWalletContracts', {
      walletId: blockchainWallet.id,
    }),
    container.model.queueService().push(
      'metricsWalletBalancesFillSelector',
      {
        id: blockchainWallet.id,
        network: blockchainWallet.network,
      },
      { topic: 'metricCurrent' },
    ),
  ]);

  return process.done();
};
