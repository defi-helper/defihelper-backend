import container from '@container';
import {
  contractTableName,
  tokenContractLinkTableName,
  TokenContractLinkType,
} from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { TagRiskType, TagType, TagPreservedName } from '@models/Tag/Entity';
import { tokenTableName } from '@models/Token/Entity';
import { riskFactorSwitcher } from '@services/RiskRanking';

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
    return String(n);
  };

  await container.model.contractService().unlinkAllTagsByType(contract, TagType.Risk);
  await container.model
    .tagService()
    .createPreserved({
      name: {
        green: TagPreservedName.RiskLow,
        yellow: TagPreservedName.RiskModerate,
        red: TagPreservedName.RiskHigh,
      }[resolvedRisk.ranking_score],
      type: TagType.Risk,
    } as TagRiskType)
    .then((tag) => container.model.contractService().linkTag(contract, tag));

  await container.model.metricService().createContract(
    contract,
    {
      totalRate: riskFactorSwitcher(resolvedRisk.ranking_score),
      reliabilityRate: riskFactorSwitcher(resolvedRisk.reliability.reliability_ranking),
      profitabilityRate: riskFactorSwitcher(resolvedRisk.profitability.profitability_ranking),
      volatilityRate: riskFactorSwitcher(resolvedRisk.volatility.volatility_ranking),

      total: verifyPercentile(resolvedRisk.total_quantile),
      profitability: verifyPercentile(resolvedRisk.profitability.profitability_quantile),
      reliability: verifyPercentile(resolvedRisk.reliability.reliability_quantile),
      volatility: verifyPercentile(resolvedRisk.volatility.volatility_quantile),
    },
    new Date(),
  );

  return process.done();
};
