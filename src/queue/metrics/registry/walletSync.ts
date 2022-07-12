import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  await container.model.metricService().walletRegistrySync();

  return process.done();
};
