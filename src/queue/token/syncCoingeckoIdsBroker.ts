import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const tokensCandidates = await container.model
    .tokenTable()
    .whereNull('coingeckoId')
    .whereIn(
      'network',
      Object.values(container.blockchain.ethereum.networks)
        .filter((n) => n.coingeckoPlatform)
        .map((n) => n.id),
    )
    .andWhere('blockchain', 'ethereum');

  const lag = 172800 / tokensCandidates.length; // 2 days
  await tokensCandidates.reduce<Promise<dayjs.Dayjs>>(async (prev, token) => {
    const startAt = await prev;

    await container.model
      .queueService()
      .push('syncCoingeckoIdsFiller', { id: token.id }, { startAt: startAt.toDate() });

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
