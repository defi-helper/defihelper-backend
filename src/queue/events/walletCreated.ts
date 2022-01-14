import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const wallet = await container.model.walletTable().where('id', id).first();
  if (!wallet) throw new Error('Wallet not found');

  if (wallet.blockchain !== 'ethereum') {
    return process.done();
  }

  await Promise.all([
    container.model.queueService().push('findWalletAppliedNetworks', {
      walletId: wallet.id,
    }),
    container.model.queueService().push('findWalletContracts', {
      walletId: wallet.id,
    }),
    container.model.queueService().push('metricsWalletBalancesFillSelector', {
      id: wallet.id,
      network: wallet.network,
    }),
    container.cache().publish(
      'defihelper:channel:onWalletCreated',
      JSON.stringify({
        id: wallet.id,
      }),
    ),
  ]);

  return process.done();
};
