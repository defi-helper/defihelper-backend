import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  contractRebalanceTableName,
  contractTableName,
  ContractVerificationStatus,
} from '@models/Automate/Entity';
import { Wallet, walletTableName } from '@models/Wallet/Entity';
import { protocolTableName } from '@models/Protocol/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .column(`${contractTableName}.contract`)
    .column<Array<Wallet & { contract: string }>>(`${walletTableName}.*`)
    .innerJoin(contractTableName, `${walletTableName}.id`, `${contractTableName}.contractWallet`)
    .innerJoin(protocolTableName, `${contractTableName}.protocol`, `${protocolTableName}.id`)
    .innerJoin(
      contractRebalanceTableName,
      `${contractTableName}.id`,
      `${contractRebalanceTableName}.contract`,
    )
    .where(`${contractTableName}.verification`, ContractVerificationStatus.Confirmed)
    .whereNull(`${contractTableName}.archivedAt`);

  const queue = container.model.queueService();
  await wallets.reduce<Promise<unknown>>(async (prev, wallet) => {
    await prev;

    return queue.push(
      'metricsWalletCurrent',
      { wallet: wallet.id, contract: wallet.contract },
      { topic: 'metricCurrent' },
    );
  }, Promise.resolve(null));

  return process.done();
};
