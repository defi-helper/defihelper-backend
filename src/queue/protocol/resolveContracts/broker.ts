import { Process } from '@models/Queue/Entity';
import container from '@container';

export default async (process: Process) => {
  const protocols = await container.model.protocolTable().where('hidden', false);

  await Promise.all(
    protocols.map(async (protocol) => {
      return container.model.queueService().push('protocolResolveContractsResolver', {
        id: protocol.id,
      });
    }),
  );

  return process.done();
};
