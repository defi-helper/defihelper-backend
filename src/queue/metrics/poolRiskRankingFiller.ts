import container from '@container';
import { MetricTokenRiskFactor } from '@models/Metric/Entity';
import {
  contractTableName,
  tokenContractLinkTableName,
  TokenContractLinkType,
} from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { TagRiskType, TagType, TagPreservedName } from '@models/Tag/Entity';
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
      .distinct(`${tokenTableName}.coingeckoId`)
      .innerJoin(tokenTableName, `${tokenContractLinkTableName}.token`, `${tokenTableName}.id`)
      .innerJoin(
        contractTableName,
        `${tokenContractLinkTableName}.contract`,
        `${contractTableName}.id`,
      )
      .where(`${tokenContractLinkTableName}.contract`, id)
      .where(`${contractTableName}.layout`, 'staking')
      .whereNotNull(`${tokenTableName}.coingeckoId`)
      .where(`${tokenContractLinkTableName}.type`, TokenContractLinkType.Stake),
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
    linkedTokens.reduce(
      (prev, cur) => ({
        ...prev,
        [cur.coingeckoId]: 0.5,
      }),
      {},
    ),
  );
  if (!resolvedRisk) {
    return process.done().info('nothing found');
  }

  const verifyPercentile = (n: number) => {
    if (n < 0 || n > 1) {
      throw new Error(`Expected volatility quantile 0.0-1.0, got ${n}`);
    }

    return n.toString(10);
  };

  const totalRate = resolvedRisk.ranking_score;
  const totalQuantile = verifyPercentile(resolvedRisk.total_quantile);
  const profitabilityQuantile = verifyPercentile(resolvedRisk.profitability_quantile);
  const reliabilityQuantile = verifyPercentile(resolvedRisk.reliability_quantile);
  const volatilityQuantile = verifyPercentile(resolvedRisk.volatility_quantile);

  await container.model.contractService().unlinkAllTagsByType(contract, TagType.Risk);
  await container.model
    .tagService()
    .createPreserved({
      name: {
        green: TagPreservedName.RiskLow,
        yellow: TagPreservedName.RiskModerate,
        red: TagPreservedName.RiskHigh,
      }[totalRate],
      type: TagType.Risk,
    } as TagRiskType)
    .then((tag) => container.model.contractService().linkTag(contract, tag));

  await container.model.metricService().createContract(
    contract,
    {
      totalRate: riskFactorSwitcher(totalRate),
      totalQuantile,
      profitabilityQuantile,
      reliabilityQuantile,
      volatilityQuantile,
    },
    new Date(),
  );

  return process.done();
};
