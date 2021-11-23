import container from '@container';
import { Process } from '@models/Queue/Entity';
import { PostProvider } from '@services/SocialStats';

const matchers = {
  [PostProvider.Medium]: (links: string[]): string[] => {
    return links.reduce<string[]>((result, link) => {
      const match = link.match(/^https?:\/\/(?:www\.)?medium\.com\/([^/]+)\/?$/i);
      if (match === null) return result;

      return [...result, match[1]];
    }, []);
  },
  [PostProvider.Twitter]: (links: string[]): string[] => {
    return links.reduce<string[]>((result, link) => {
      const match = link.match(/^https?:\/\/(?:www\.)?twitter\.com\/([^/]+)\/?$/i);
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

          return queue.push('metricsProtocolLinksPost', { provider, protocol: protocol.id, ids });
        }),
      );
    }),
  );

  return process.done();
};
