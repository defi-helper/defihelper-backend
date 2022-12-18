import container from '@container';
import {
  Contract,
  tokenContractLinkTableName,
  TokenContractLinkType,
} from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { TagRiskType, TagType, TagPreservedName } from '@models/Tag/Entity';
import { tokenPartTableName, tokenTableName } from '@models/Token/Entity';
import { PoolRisking, riskFactorSwitcher } from '@services/RiskRanking';
import dayjs from 'dayjs';

const verifyPercentile = (n: number) => {
  if (n < 0 || n > 1) {
    throw new Error(`Expected volatility quantile 0.0-1.0, got ${n}`);
  }
  return String(n);
};

const defaultHigtRisk: PoolRisking = {
  score: 0,
  total_quantile: 0,
  ranking_score: 'red',
  volatility: {
    volatility_quantile: 0,
    volatility_ranking: 'red',
  },
  reliability: {
    reliability_quantile: 0,
    reliability_ranking: 'red',
  },
  profitability: {
    profitability_quantile: 0,
    profitability_ranking: 'red',
  },
};

async function setRisk(contract: Contract, risk: PoolRisking) {
  await container.model.contractService().unlinkAllTagsByType(contract, TagType.Risk);
  await container.model
    .tagService()
    .createPreserved({
      name: {
        green: TagPreservedName.RiskLow,
        yellow: TagPreservedName.RiskModerate,
        red: TagPreservedName.RiskHigh,
      }[risk.ranking_score],
      type: TagType.Risk,
    } as TagRiskType)
    .then((tag) => container.model.contractService().linkTag(contract, tag));

  await container.model.metricService().createContract(
    contract,
    {
      totalRate: riskFactorSwitcher(risk.ranking_score),
      reliabilityRate: riskFactorSwitcher(risk.reliability.reliability_ranking),
      profitabilityRate: riskFactorSwitcher(risk.profitability.profitability_ranking),
      volatilityRate: riskFactorSwitcher(risk.volatility.volatility_ranking),
      total: verifyPercentile(risk.total_quantile),
      profitability: verifyPercentile(risk.profitability.profitability_quantile),
      reliability: verifyPercentile(risk.reliability.reliability_quantile),
      volatility: verifyPercentile(risk.volatility.volatility_quantile),
    },
    new Date(),
  );
}

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const updateDatetime = await container.riskRanking().getUpdateDatetime();
  if (
    !updateDatetime ||
    dayjs().startOf('day').isAfter(updateDatetime.update_end) ||
    dayjs().isBefore(updateDatetime.update_end)
  ) {
    return process.laterAt(1, 'hour');
  }

  const { id } = process.task.params as Params;
  const [contract, stakeToken] = await Promise.all([
    container.model.contractTable().where('id', id).first(),
    container.model
      .tokenTable()
      .column(`${tokenTableName}.*`)
      .innerJoin(
        tokenContractLinkTableName,
        `${tokenContractLinkTableName}.token`,
        `${tokenTableName}.id`,
      )
      .innerJoin(
        tokenPartTableName,
        `${tokenContractLinkTableName}.token`,
        `${tokenPartTableName}.parent`,
      )
      .where(`${tokenContractLinkTableName}.contract`, id)
      .where(`${tokenContractLinkTableName}.type`, TokenContractLinkType.Stake)
      .groupBy(`${tokenTableName}.id`)
      .havingRaw(`count(${tokenPartTableName}.id) = 2`)
      .first(),
  ]);
  if (!contract) {
    throw new Error(`No contract found with id ${id}`);
  }
  if (!stakeToken) {
    throw new Error('Invalid stake token');
  }

  const linkedTokens = await container.model
    .tokenTable()
    .column(`${tokenTableName}.*`)
    .innerJoin(tokenPartTableName, `${tokenTableName}.id`, `${tokenPartTableName}.child`)
    .where(`${tokenPartTableName}.parent`, stakeToken.id)
    .whereNotNull(`${tokenTableName}.coingeckoId`);
  if (linkedTokens.length < 2) {
    await setRisk(contract, defaultHigtRisk);
    return process.done();
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
    await setRisk(contract, defaultHigtRisk);
    return process.done();
  }

  await setRisk(contract, resolvedRisk);

  return process.done();
};
