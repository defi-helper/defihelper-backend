import container from '@container';
import { MetricWalletToken, QueryModify } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const metricService = container.model.metricService();
  const metrics = await container.model
    .metricWalletTokenTable()
    .modify(QueryModify.lastValue, ['contract', 'wallet', 'token']);
  await metrics.reduce(
    async (prev: Promise<any>, metric: MetricWalletToken) =>
      prev.then(() => metricService.updateWalletTokenRegistry(metric)),
    Promise.resolve(null),
  );

  return process.done();
};
