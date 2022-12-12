import container from '@container';
import { Process } from '@models/Queue/Entity';
import { riskFactorSwitcher } from '@services/RiskRanking';

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

  const verifyPercentile = (n: number) => {
    if (n < 0 || n > 1) {
      throw new Error(`Expected volatility quantile 0.0-1.0, got ${n}`);
    }
    return String(n);
  };

  await container.model.metricService().createToken(
    token,
    {
      totalRate: riskFactorSwitcher(resolvedRisk.total.ranking),
      reliabilityRate: riskFactorSwitcher(resolvedRisk.reliability.ranking_reliability),
      profitabilityRate: riskFactorSwitcher(resolvedRisk.profitability.ranking_profitability),
      volatilityRate: riskFactorSwitcher(resolvedRisk.volatility.ranking_volatility),

      total: verifyPercentile(resolvedRisk.total.quantile_scoring),
      profitability: verifyPercentile(resolvedRisk.profitability.quantile_profitability_scoring),
      reliability: verifyPercentile(resolvedRisk.reliability.quantile_reliability_scoring),
      volatility: verifyPercentile(resolvedRisk.volatility.quantile_volatility_scoring),
    },
    new Date(),
  );

  return process.done();
};
