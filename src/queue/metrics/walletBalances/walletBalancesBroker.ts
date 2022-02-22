import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

export default async (process: Process) => {
  const wallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum');

  const lag = 86400 / wallets.length;
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;

    await container.model.queueService().push(
      'metricsWalletBalancesFillSelector',
      {
        id: wallet.id,
        network: wallet.network,
      },
      { startAt: startAt.toDate() },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
