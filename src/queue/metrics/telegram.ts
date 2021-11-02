import container from '@container';
import { Process } from '@models/Queue/Entity';

export interface Params {
  protocol: string;
}

export default async (process: Process) => {
  const { protocol: protocolId } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  const links = (protocol.links.social ?? [])
    .filter(({ name }) => name.toLowerCase() === 'telegram')
    .map(({ value }) => value);
  const channels = links
    .map((link) => (link.match(/\/([^/]+)$/i) ?? [])[1])
    .filter((v) => typeof v === 'string');

  const socialStatsGateway = container.socialStats();
  const socialStats = await Promise.all(
    channels.map(async (channelId) => {
      const { followers } = await socialStatsGateway.follower('telegram', channelId);

      return followers;
    }),
  );
  const followersSum = socialStats.reduce((sum, followers) => sum + followers, 0);

  await container.model.metricService().createProtocol(
    protocol,
    {
      telegramFollowers: followersSum.toString(),
    },
    new Date(),
  );

  return process.done();
};
