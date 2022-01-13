import container from '@container';
import { Process } from '@models/Queue/Entity';
import { CoinProvider } from '@services/SocialStats';

export interface Params {
  provider: CoinProvider;
  protocol: string;
  ids: { value: string; id: string }[];
}

export default async (process: Process) => {
  const { provider, protocol: protocolId, ids } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const socialStatsGateway = container.socialStats();
  await Promise.all(
    ids.map(async (link) => {
      const { watchers } = await socialStatsGateway.coin(provider, link.value);

      return container.model.metricService().createProtocol(
        protocol,
        {
          [`${provider}Watchers`]: watchers.toString(),
          entityIdentifier: link.id,
        },
        new Date(),
      );
    }),
  );

  return process.done();
};
