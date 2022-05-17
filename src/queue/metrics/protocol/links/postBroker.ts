import container from '@container';
import { Process } from '@models/Queue/Entity';
import { PostProvider } from '@services/SocialStats';
import dayjs from 'dayjs';

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

      const lag = 43200 / Object.entries(matchers).length; // 12hrs
      return Object.entries(matchers).reduce<Promise<dayjs.Dayjs>>(
        async (prev, [provider, matcher]) => {
          const startAt = await prev;

          const ids = matcher(links);
          if (ids.length > 0) {
            await queue.push('metricsProtocolLinksPost', { provider, protocol: protocol.id, ids });
            return startAt.clone().add(lag, 'seconds');
          }

          return startAt;
        },
        Promise.resolve(dayjs()),
      );
    }),
  );

  return process.done();
};
