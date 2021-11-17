import container from '@container';
import { Process } from '@models/Queue/Entity';
import { SocialProvider } from '@services/SocialStats';

const matchers = {
  [SocialProvider.Telegram]: (links: string[]): string[] => {
    return links.reduce<string[]>((result, link) => {
      const match = link.match(/^https?:\/\/t\.me\/([^/]+)/i);
      if (match === null) return result;

      return [...result, match[1]];
    }, []);
  },
};

export default async (process: Process) => {
  const protocols = await container.model.protocolTable();
  const queue = container.model.queueService();
  await Promise.all(
    protocols.map(async (protocol) => {
      const links = protocol.links.social?.map(({ value }) => value) ?? [];

      return Promise.all(
        Object.entries(matchers).map(([provider, matcher]) => {
          const ids = matcher(links);
          if (ids.length === 0) return null;

          return queue.push('metricsProtocolLinksSocial', { provider, protocol: protocol.id, ids });
        }),
      );
    }),
  );

  return process.done();
};
