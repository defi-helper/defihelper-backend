import container from '@container';
import { metricWalletTokenRegistryTableName, QueryModify } from '@models/Metric/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { TokenAlias, Token, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import DataLoader from 'dataloader';

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
      usdWeekBefore: string;
      usdMonthBefore: string;
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
      .modify(QueryModify.sumMetric, [
        'usdWeekBefore',
        `${metricWalletTokenRegistryTableName}.data->>'usdWeekBefore'`,
      ])
      .modify(QueryModify.sumMetric, [
        'usdMonthBefore',
        `${metricWalletTokenRegistryTableName}.data->>'usdMonthBefore'`,
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
          usdWeekBefore: string;
          usdMonthBefore: string;
        }>,
      ) =>
        new Map(
          rows.map(({ alias, usd, balance, usdDayBefore, usdWeekBefore, usdMonthBefore }) => [
            alias,
            {
              usd,
              usdDayBefore,
              usdWeekBefore,
              usdMonthBefore,
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
          usdWeekBefore: '0',
          usdMonthBefore: '0',
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
