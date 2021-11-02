import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const protocols = await container.model
    .protocolTable()
    .whereRaw(`'telegram' IN (SELECT LOWER(jsonb_array_elements(links->'social')->>'name'))`);

  await Promise.all(
    protocols.map(({ id: protocol }) => queue.push('metricsProtocolTelegram', { protocol })),
  );

  return process.done();
};
