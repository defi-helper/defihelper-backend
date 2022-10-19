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

  const risk =
    {
      green: MetricTokenRiskFactor.low,
      yellow: MetricTokenRiskFactor.moderate,
      red: MetricTokenRiskFactor.high,
    }[resolvedRisk.total.ranking] ?? MetricTokenRiskFactor.notCalculated;

  const volatility = resolvedRisk.volatility.quantile_volatility_scoring;
  const profitability = resolvedRisk.profitability.quantile_profitability_scoring;
  const reliability = resolvedRisk.reliability.quantile_reliability_scoring;

  if (volatility < 0 || volatility > 1) {
    throw new Error(`Expected volatility quantile 0.0-1.0, got ${volatility}`);
  }

  if (profitability < 0 || profitability > 1) {
    throw new Error(`Expected profitability quantile 0.0-1.0, got ${profitability}`);
  }

  if (reliability < 0 || reliability > 1) {
    throw new Error(`Expected reliability quantile 0.0-1.0, got ${reliability}`);
  }

  await container.model.metricService().createToken(
    token,
    {
      risk,
      reliability: reliability.toString(10),
      profitability: profitability.toString(10),
      volatility: volatility.toString(10),
    },
    new Date(),
  );

  return process.done();
};
