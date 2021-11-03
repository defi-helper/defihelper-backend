import container from '@container';
import { Process } from '@models/Queue/Entity';
import { CoinProvider } from '@services/SocialStats';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all(
    Object.values(CoinProvider).map(async (provider) => {
      const protocols = await container.model
        .protocolTable()
        .whereRaw(
          `'${provider}' IN (SELECT LOWER(jsonb_array_elements(links->'listing')->>'name'))`,
        );

      return Promise.all(
        protocols.map(({ id: protocol }) =>
          queue.push('metricsProtocolLinksListing', { provider, protocol }),
        ),
      );
    }),
  );

  return process.done();
};
