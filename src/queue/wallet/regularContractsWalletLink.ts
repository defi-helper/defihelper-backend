import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { WalletBlockchain } from '@models/Wallet/Entity';

export const chunk = (arr: WalletBlockchain[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_: WalletBlockchain, i: number) =>
    arr.slice(i * size, i * size + size),
  );

export default async (process: Process) => {
  const wallets = chunk(
    await container.model
      .walletBlockchainTable()
      .where('blockchain', 'ethereum')
      .distinctOn('address'),
    95,
  );

  const lag = 86400 / wallets.length; // seconds in day
  await wallets.reduce<Promise<dayjs.Dayjs>>(async (prev, wallet) => {
    const startAt = await prev;
    await container.model.queueService().push(
      'findWalletContractsBulk',
      {
        wallets: wallet.map((v) => v.address),
      },
      { startAt: startAt.toDate() },
    );
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
