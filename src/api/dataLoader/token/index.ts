import container from '@container';
import { metricWalletTokenRegistryTableName } from '@models/Metric/Entity';
import { TokenAlias, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
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

export const tokenAliasUserLastMetricLoader = ({ user }: { user: string }) =>
  new DataLoader<string, { usd: string; balance: string }>(async (tokenAliasIds) => {
    const database = container.database();
    const map = await container.model
      .metricWalletTokenRegistryTable()
      .column(`${tokenAliasTableName}.id as alias`)
      .column(
        database.raw(
          `SUM((COALESCE(${metricWalletTokenRegistryTableName}.data->>'balance', '0'))::numeric) as balance`,
        ),
      )
      .column(
        database.raw(
          `SUM((COALESCE(${metricWalletTokenRegistryTableName}.data->>'usd', '0'))::numeric) as usd`,
        ),
      )
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
      .groupBy(`${tokenAliasTableName}.id`)
      .then((rows) => new Map(rows.map(({ alias, usd, balance }) => [alias, { usd, balance }])));

    return tokenAliasIds.map((id) => map.get(id) ?? { usd: '0', balance: '0' });
  });
