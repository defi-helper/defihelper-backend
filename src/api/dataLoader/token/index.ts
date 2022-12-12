import container from '@container';
import {
  metricTokenRegistryTableName,
  metricWalletTokenRegistryTableName,
  QueryModify,
  RegistryPeriod,
} from '@models/Metric/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { TokenAlias, Token, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { RiskFactor } from '@services/RiskRanking';
import DataLoader from 'dataloader';
import BN from 'bignumber.js';
import dayjs from 'dayjs';

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

    const [latestMap, dayBeforeMap] = await Promise.all([
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'balance',
          `${metricWalletTokenRegistryTableName}.data->>'balance'`,
        ])
        .modify(QueryModify.sumMetric, [
          'usd',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().add(1, 'day').startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              alias: string;
              balance: string;
              usd: string;
            }>,
          ) => new Map(rows.map(({ alias, usd, balance }) => [alias, { usd, balance }])),
        ),
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'usdDayBefore',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Day)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              alias: string;
              usdDayBefore: string;
            }>,
          ) => new Map(rows.map(({ alias, usdDayBefore }) => [alias, { usdDayBefore }])),
        ),
    ]);

    return tokenAliasIds.map((id) => {
      const latest = latestMap.get(id) ?? {
        balance: '0',
        usd: '0',
      };
      const dayBefore = dayBeforeMap.get(id) ?? {
        usdDayBefore: '0',
      };
      return { ...latest, ...dayBefore };
    });
  });

export const tokenLastMetricLoader = () =>
  new DataLoader<
    string,
    {
      totalRate: RiskFactor;
      reliabilityRate: RiskFactor;
      profitabilityRate: RiskFactor;
      volatilityRate: RiskFactor;
      total: number;
      reliability: number;
      volatility: number;
      profitability: number;
    }
  >(async (tokensIds) => {
    const select = container.model
      .metricTokenRegistryTable()
      .column(`${metricTokenRegistryTableName}.token`)
      .column(`${metricTokenRegistryTableName}.data`)
      .where(`${metricTokenRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereIn(`${metricTokenRegistryTableName}.token`, tokensIds);

    const map = await select.then(
      (
        rows: Array<{
          token: string;
          data: {
            totalRate: RiskFactor;
            reliabilityRate: RiskFactor;
            profitabilityRate: RiskFactor;
            volatilityRate: RiskFactor;
            total: string;
            reliability: string;
            volatility: string;
            profitability: string;
          };
        }>,
      ) =>
        new Map(
          rows.map(
            ({
              token,
              data: {
                totalRate,
                reliabilityRate,
                profitabilityRate,
                volatilityRate,
                reliability,
                volatility,
                profitability,
                total,
              },
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
          totalRate: RiskFactor.notCalculated,
          reliabilityRate: RiskFactor.notCalculated,
          profitabilityRate: RiskFactor.notCalculated,
          volatilityRate: RiskFactor.notCalculated,
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
