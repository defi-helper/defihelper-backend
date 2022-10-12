import container from '@container';
import { MetricTokenRiskFactor } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const token = await container.model.tokenTable().where('id', id).first();

  if (!token) {
    throw new Error(`No token found with id ${id}`);
  }

  if (!token.coingeckoId) {
    throw new Error('No coingeckoId found');
  }

  const resolvedRisk = await container.riskRanking().getCoinInfo(token.coingeckoId);
  if (!resolvedRisk) {
    return process.done().info('no coin found');
  }

  let risk = MetricTokenRiskFactor.notCalculated;
  switch (resolvedRisk.total.svetofor) {
    case 'green':
      risk = MetricTokenRiskFactor.low;
      break;

    case 'yellow':
      risk = MetricTokenRiskFactor.moderate;
      break;

    case 'red':
      risk = MetricTokenRiskFactor.high;
      break;

    default:
      throw new Error('No risk case found');
  }

  await container.model.metricService().createToken(
    token,
    {
      risk,
    },
    new Date(),
  );

  return process.done();
};
