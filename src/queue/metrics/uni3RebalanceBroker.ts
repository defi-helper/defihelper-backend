import dayjs from 'dayjs';
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

  const lag = 60 / wallets.length; // 1 minutes
  const queue = container.model.queueService();
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;

    await queue.push(
      'metricsWalletCurrent',
      { wallet: wallet.id, contract: wallet.contract },
      { topic: 'metricCurrent', startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
