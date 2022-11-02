import container from '@container';
import {
  metricTokenRegistryTableName,
  MetricTokenRiskFactor,
  metricWalletTokenRegistryTableName,
  QueryModify,
} from '@models/Metric/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { TokenAlias, Token, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import DataLoader from 'dataloader';
import BN from 'bignumber.js';

export const tokenAliasLoader = () =>
  new DataLoader<string, TokenAlias | null>(async (tokensAliasId) => {
    const map = await container.model
      .tokenAliasTable()
      .whereIn('id', tokensAliasId)
      .then((rows) => new Map(rows.map((alias) => [alias.id, alias])));

    return tokensAliasId.map((id) => map.get(id) ?? null);
  });

export const tokenAliasUserLastMetricLoader = ({
  user,
  protocol,
}: {
  user: string;
  protocol?: string;
}) =>
  new DataLoader<
    string,
    {
      usd: string;
      balance: string;
      usdDayBefore: string;
    }
  >(async (tokenAliasIds) => {
    const select = container.model
      .metricWalletTokenRegistryTable()
      .column(`${tokenAliasTableName}.id as alias`)
      .modify(QueryModify.sumMetric, [
        'balance',
        `${metricWalletTokenRegistryTableName}.data->>'balance'`,
      ])
      .modify(QueryModify.sumMetric, ['usd', `${metricWalletTokenRegistryTableName}.data->>'usd'`])
      .modify(QueryModify.sumMetric, [
        'usdDayBefore',
        `${metricWalletTokenRegistryTableName}.data->>'usdDayBefore'`,
      ])
      .innerJoin(
        walletTableName,
        `${walletTableName}.id`,
        `${metricWalletTokenRegistryTableName}.wallet`,
      )
      .innerJoin(
        tokenTableName,
        `${tokenTableName}.id`,
        `${metricWalletTokenRegistryTableName}.token`,
      )
      .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
      .where(`${walletTableName}.user`, user)
      .whereNull(`${walletTableName}.deletedAt`)
      .whereIn(`${tokenAliasTableName}.id`, tokenAliasIds)
      .groupBy(`${tokenAliasTableName}.id`);
    if (protocol !== undefined) {
      select
        .innerJoin(
          contractTableName,
          `${metricWalletTokenRegistryTableName}.contract`,
          `${contractTableName}.id`,
        )
        .innerJoin(
          contractBlockchainTableName,
          `${contractBlockchainTableName}.id`,
          `${contractTableName}.id`,
        )
        .where(`${contractTableName}.protocol`, protocol);
    }

    const map = await select.then(
      (
        rows: Array<{
          alias: string;
          balance: string;
          usd: string;
          usdDayBefore: string;
        }>,
      ) =>
        new Map(
          rows.map(({ alias, usd, balance, usdDayBefore }) => [
            alias,
            {
              usd,
              usdDayBefore,
              balance,
            },
          ]),
        ),
    );

    return tokenAliasIds.map(
      (id) =>
        map.get(id) ?? {
          usd: '0',
          balance: '0',
          usdDayBefore: '0',
        },
    );
  });

export const tokenLastMetricLoader = () =>
  new DataLoader<
    string,
    {
      totalRate: MetricTokenRiskFactor;
      reliabilityRate: MetricTokenRiskFactor;
      profitabilityRate: MetricTokenRiskFactor;
      volatilityRate: MetricTokenRiskFactor;
      total: number;
      reliability: number;
      volatility: number;
      profitability: number;
    }
  >(async (tokensIds) => {
    const select = container.model
      .metricTokenRegistryTable()
      .column(`${metricTokenRegistryTableName}.id as token`)
      .column(`${metricTokenRegistryTableName}.data`)
      .whereIn(`${metricTokenRegistryTableName}.token`, tokensIds);

    const map = await select.then(
      (
        rows: Array<{
          token: string;
          totalRate: MetricTokenRiskFactor;
          reliabilityRate: MetricTokenRiskFactor;
          profitabilityRate: MetricTokenRiskFactor;
          volatilityRate: MetricTokenRiskFactor;
          total: string;
          reliability: string;
          volatility: string;
          profitability: string;
        }>,
      ) =>
        new Map(
          rows.map(
            ({
              token,
              totalRate,
              reliabilityRate,
              profitabilityRate,
              volatilityRate,
              reliability,
              volatility,
              profitability,
              total,
            }) => [
              token,
              {
                totalRate,
                reliabilityRate,
                profitabilityRate,
                volatilityRate,
                reliability: new BN(reliability ?? 1).toNumber(),
                volatility: new BN(volatility ?? 1).toNumber(),
                profitability: new BN(profitability ?? 1).toNumber(),
                total: new BN(total ?? 1).toNumber(),
              },
            ],
          ),
        ),
    );

    return tokensIds.map(
      (id) =>
        map.get(id) ?? {
          totalRate: MetricTokenRiskFactor.notCalculated,
          reliabilityRate: MetricTokenRiskFactor.notCalculated,
          profitabilityRate: MetricTokenRiskFactor.notCalculated,
          volatilityRate: MetricTokenRiskFactor.notCalculated,
          reliability: 1,
          volatility: 1,
          profitability: 1,
          total: 1,
        },
    );
  });

export const tokenLoader = () =>
  new DataLoader<string, Token | null>(async (tokensId) => {
    const map = await container.model
      .tokenTable()
      .whereIn('id', tokensId)
      .then((rows) => new Map(rows.map((token) => [token.id, token])));

    return tokensId.map((id) => map.get(id) ?? null);
  });
