import container from '@container';
import { MetricTokenRiskFactor } from '@models/Metric/Entity';
import { tokenContractLinkTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { tokenTableName } from '@models/Token/Entity';
import { RawRiskRank } from '@services/RiskRanking';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const [contract, linkedTokens] = await Promise.all([
    container.model.contractTable().where('id', id).first(),
    container.model
      .tokenContractLinkTable()
      .column(`${tokenTableName}.coingeckoId`)
      .innerJoin(
        tokenContractLinkTableName,
        `${tokenContractLinkTableName}.token`,
        `${tokenTableName}.id`,
      )
      .where('contract', id)
      .andWhereNot('coingeckoId', null)
      .andWhere('type', 'stake'),
  ]);

  if (!contract) {
    throw new Error(`No contract found with id ${id}`);
  }

  if (linkedTokens.length < 2) {
    throw new Error('not enough linked tokens');
  }

  const riskFactorSwitcher = (input: RawRiskRank) => {
    return (
      {
        green: MetricTokenRiskFactor.low,
        yellow: MetricTokenRiskFactor.moderate,
        red: MetricTokenRiskFactor.high,
      }[input] ?? MetricTokenRiskFactor.notCalculated
    );
  };

  const resolvedRisk = await container.riskRanking().getPoolScoring(
    linkedTokens.reduce((prev, cur) => ({
      ...prev,
      [cur.coingeckoId]: 0.5,
    })),
  );
  if (!resolvedRisk) {
    return process.done().info('nothing found');
  }

  const totalRate = resolvedRisk.ranking_score;
  const totalQuantile = 1; // fixme

  await container.model.metricService().createContract(
    contract,
    {
      totalRate: riskFactorSwitcher(totalRate),
      totalQuantile: totalQuantile.toString(10),
    },
    new Date(),
  );

  return process.done();
};
