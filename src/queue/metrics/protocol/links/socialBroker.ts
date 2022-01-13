import container from '@container';
import { Process } from '@models/Queue/Entity';
import { SocialProvider } from '@services/SocialStats';

interface LinkPair {
  value: string;
  id: string;
}

const matchers = {
  [SocialProvider.Telegram]: (links: LinkPair[]): LinkPair[] => {
    return links.reduce<LinkPair[]>((result, link) => {
      const match = link.value.match(/^https?:\/\/t\.me\/([^/]+)/i);
      if (match === null) return result;

      return [...result, { value: match[1], id: link.id }];
    }, []);
  },
};

export default async (process: Process) => {
  const protocols = await container.model.protocolTable();
  const queue = container.model.queueService();
  await Promise.all(
    protocols.map(async (protocol) => {
      const links =
        protocol.links.social?.map(({ value, id }) => {
          return { value, id };
        }) ?? [];

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
