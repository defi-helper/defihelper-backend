import container from '@container';
import { Process } from '@models/Queue/Entity';
import { CoinProvider } from '@services/SocialStats';

export interface Params {
  provider: CoinProvider;
  protocol: string;
  ids: string[];
}

export default async (process: Process) => {
  const { provider, protocol: protocolId, ids } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const socialStatsGateway = container.socialStats();
  const socialStats = await Promise.all(
    ids.map(async (id) => {
      const { watchers } = await socialStatsGateway.coin(provider, id);

      return watchers;
    }),
  );
  const watchersSum = socialStats.reduce((sum, watchers) => sum + watchers, 0);

  await container.model.metricService().createProtocol(
    protocol,
    {
      [`${provider}Watchers`]: watchersSum.toString(),
    },
    new Date(),
  );

  return process.done();
};
