import container from '@container';
import { Process } from '@models/Queue/Entity';
import { PostProvider } from '@services/SocialStats';

export default async (process: Process) => {
  const queue = container.model.queueService();
  await Promise.all(
    Object.values(PostProvider).map(async (provider) => {
      const protocols = await container.model
        .protocolTable()
        .whereRaw(
          `'${provider}' IN (SELECT LOWER(jsonb_array_elements(links->'social')->>'name'))`,
        );

      return Promise.all(
        protocols.map(({ id: protocol }) =>
          queue.push('metricsProtocolLinksPost', { provider, protocol }),
        ),
      );
    }),
  );

  return process.done();
};
