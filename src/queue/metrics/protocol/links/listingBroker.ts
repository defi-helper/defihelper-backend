import container from '@container';
import { Process } from '@models/Queue/Entity';
import { CoinProvider } from '@services/SocialStats';

const matchers = {
  [CoinProvider.CoinGecko]: (links: string[]): string[] => {
    return links.reduce<string[]>((result, link) => {
      const match = link.match(/^https:\/\/(?:www\.)?coingecko.com\/.*\/([^/]+)$/i);
      if (match === null) return result;

      return [...result, match[1]];
    }, []);
  },
  [CoinProvider.CoinMarketCap]: (links: string[]): string[] => {
    return links.reduce<string[]>((result, link) => {
      const match = link.match(/^https:\/\/(?:www\.)?coinmarketcap.com\/.*\/([^/]+)$/i);
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
      const links = protocol.links.listing?.map(({ value }) => value) ?? [];

      return Promise.all(
        Object.entries(matchers).map(([provider, matcher]) => {
          const ids = matcher(links);
          if (ids.length === 0) return null;

          return queue.push('metricsProtocolLinksListing', {
            provider,
            protocol: protocol.id,
            ids,
          });
        }),
      );
    }),
  );

  return process.done();
};
