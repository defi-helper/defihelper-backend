import container from '@container';
import { Process } from '@models/Queue/Entity';
import { CoinProvider } from '@services/SocialStats';

const matchers = {
  [CoinProvider.CoinGecko]: (
    links: { value: string; id: string }[],
  ): { value: string; id: string }[] => {
    return links.reduce<{ value: string; id: string }[]>((result, link) => {
      const match = link.value.match(/^https:\/\/(?:www\.)?coingecko.com\/.*\/([^/]+)\/?$/i);
      if (match === null) return result;

      return [...result, { value: match[1], id: link.id }];
    }, []);
  },
  [CoinProvider.CoinMarketCap]: (
    links: { value: string; id: string }[],
  ): { value: string; id: string }[] => {
    return links.reduce<{ value: string; id: string }[]>((result, link) => {
      const match = link.value.match(/^https:\/\/(?:www\.)?coinmarketcap.com\/.*\/([^/]+)\/?$/i);
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
        protocol.links.listing?.map(({ value, id }) => {
          return { value, id };
        }) ?? [];

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
