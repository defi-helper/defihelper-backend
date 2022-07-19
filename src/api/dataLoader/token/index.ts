import container from '@container';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
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
    const select = container.model
      .metricWalletTokenTable()
      .distinctOn(
        `${metricWalletTokenTableName}.contract`,
        `${metricWalletTokenTableName}.wallet`,
        `${metricWalletTokenTableName}.token`,
      )
      .column(`${tokenAliasTableName}.id AS alias`)
      .column(
        database.raw(`(COALESCE(${metricWalletTokenTableName}.data->>'usd', '0'))::numeric AS usd`),
      )
      .column(
        database.raw(
          `(COALESCE(${metricWalletTokenTableName}.data->>'balance', '0'))::numeric AS balance`,
        ),
      )
      .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTokenTableName}.wallet`)
      .innerJoin(tokenTableName, `${tokenTableName}.id`, `${metricWalletTokenTableName}.token`)
      .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
      .where(`${walletTableName}.user`, user)
      .whereNull(`${walletTableName}.deletedAt`)
      .whereIn(`${tokenAliasTableName}.id`, tokenAliasIds)
      .orderBy(`${metricWalletTokenTableName}.contract`)
      .orderBy(`${metricWalletTokenTableName}.wallet`)
      .orderBy(`${metricWalletTokenTableName}.token`)
      .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');

    const map = await container
      .database()
      .column('alias')
      .sum('usd AS usd')
      .sum('balance AS balance')
      .from(select.clone().as('metric'))
      .groupBy('alias')
      .then((rows) => new Map(rows.map(({ alias, usd, balance }) => [alias, { usd, balance }])));

    return tokenAliasIds.map((id) => map.get(id) ?? { usd: '0', balance: '0' });
  });
