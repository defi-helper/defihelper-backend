// import container from '@container';
// import { MetricWallet, QueryModify } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  /*
  const metricService = container.model.metricService();
  const metrics = await container.model
    .metricWalletTable()
    .modify(QueryModify.lastValue, ['contract', 'wallet']);
  await metrics.reduce(
    async (prev: Promise<any>, metric: MetricWallet) =>
      prev.then(() => metricService.updateWalletRegistry(metric)),
    Promise.resolve(null),
  );
  */

  return process.done();
};
