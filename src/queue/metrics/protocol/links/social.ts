import container from '@container';
import { Process } from '@models/Queue/Entity';
import { SocialProvider } from '@services/SocialStats';

export interface Params {
  provider: SocialProvider;
  protocol: string;
  ids: string[];
}

export default async (process: Process) => {
  const { provider, protocol: protocolId, ids } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const socialStatsGateway = container.socialStats();
  await Promise.all(
    ids.map(async (id) => {
      const { followers } = await socialStatsGateway.social(provider, id);

      await container.model.metricService().createProtocol(
        protocol,
        {
          [`${provider}Followers`]: followers.toString(),
          entityIdentifier: id,
        },
        new Date(),
      );

      return followers;
    }),
  );

  return process.done();
};
