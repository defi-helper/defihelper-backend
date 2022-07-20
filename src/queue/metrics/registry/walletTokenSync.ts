import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const metricService = container.model.metricService();
  const metrics = await container.model
    .metricWalletTokenTable()
    .distinctOn('contract', 'wallet', 'token')
    .orderBy('contract')
    .orderBy('wallet')
    .orderBy('token')
    .orderBy('date', 'desc');
  await metrics.reduce<Promise<unknown>>(
    async (prev, metric) => prev.then(() => metricService.updateWalletTokenRegistry(metric)),
    Promise.resolve(null),
  );

  return process.done();
};
