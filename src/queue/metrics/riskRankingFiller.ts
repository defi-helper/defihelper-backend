import container from '@container';
import { TokenRiskFactor } from '@models/Metric/Entity';
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

  const lastMetric = await container.model
    .metricTokenTable()
    .where('token', token.id)
    .orderBy('date', 'desc')
    .first();

  if (!lastMetric) {
    throw new Error(`No last metric found for token`);
  }

  const resolvedRisk = await container.riskRanking().getCoinInfo(token.coingeckoId);
  if (!resolvedRisk) {
    return process.done().info('no coin found');
  }

  let risk = TokenRiskFactor.notCalculated;
  switch (resolvedRisk.total.svetofor) {
    case 'green':
      risk = TokenRiskFactor.low;
      break;

    case 'yellow':
      risk = TokenRiskFactor.moderate;
      break;

    case 'red':
      risk = TokenRiskFactor.high;
      break;

    default:
      throw new Error('No risk case found');
  }

  await container.model.metricService().createToken(
    token,
    {
      ...lastMetric.data,
      risk,
    },
    new Date(),
  );

  return process.done();
};
