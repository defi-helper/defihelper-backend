import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

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
  if (blockchainWallet.blockchain === 'ethereum') {
    await Promise.all([
      container.model
        .queueService()
        .push(
          'findWalletAppliedNetworks',
          { walletId: blockchainWallet.id },
          { topic: 'metricCurrent' },
        ),
      container.model.queueService().push('findWalletContracts', { walletId: blockchainWallet.id }),
    ]);

    if (
      blockchainWallet.type === WalletBlockchainType.Wallet &&
      !container.blockchain.ethereum.byNetwork(blockchainWallet.network).testnet
    ) {
      await container.model
        .queueService()
        .push(
          'metricsWalletBalancesDeBankFiller',
          { id: blockchainWallet.id },
          { topic: 'metricCurrent' },
        );
    }
  }

  if (blockchainWallet.blockchain === 'waves') {
    await container.model
      .queueService()
      .push(
        'metricsWalletBalancesWavesFiller',
        { id: blockchainWallet.id },
        { topic: 'metricCurrent' },
      );
  }

  return process.done();
};
