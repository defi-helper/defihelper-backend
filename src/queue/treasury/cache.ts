import container from '@container';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
import { Process } from '@models/Queue/Entity';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { Role } from '@models/User/Entity';

export default async (process: Process) => {
  const database = container.database();

  const [protocolsRow, contractsRow, portfoliosRow, walletsRow, trackedRow] = await Promise.all([
    container.model.protocolTable().count().where('hidden', false).first(),
    container.model.contractTable().count().where('hidden', false).first(),
    container.model.userTable().count().whereIn('role', [Role.User, Role.Admin]).first(),
    container.model.walletTable().count().first(),
    container
      .database()
      .sum('usd AS usd')
      .from(
        container.model
          .metricWalletTokenTable()
          .distinctOn(
            `${metricWalletTokenTableName}.wallet`,
            `${metricWalletTokenTableName}.contract`,
            `${metricWalletTokenTableName}.token`,
          )
          .column(`${metricWalletTokenTableName}.token`)
          .column(database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS usd`))
          .innerJoin(tokenTableName, `${metricWalletTokenTableName}.token`, `${tokenTableName}.id`)
          .innerJoin(tokenAliasTableName, `${tokenTableName}.alias`, `${tokenAliasTableName}.id`)
          .where(function () {
            this.whereIn(`${tokenAliasTableName}.liquidity`, [
              TokenAliasLiquidity.Stable,
              TokenAliasLiquidity.Unstable,
            ]);
            this.andWhere(database.raw(`${metricWalletTokenTableName}.data->>'usd' IS NOT NULL`));
            this.andWhere(database.raw(`${metricWalletTokenTableName}.data->>'usd' != 'NaN'`));
          })
          .orderBy(`${metricWalletTokenTableName}.wallet`)
          .orderBy(`${metricWalletTokenTableName}.contract`)
          .orderBy(`${metricWalletTokenTableName}.token`)
          .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
          .as('metric'),
      )
      .first(),
  ]);

  container.cacheLegacy().setex(
    'defihelper:treasury:stats',
    259200, // 3 days
    JSON.stringify({
      protocolsCount: protocolsRow ? protocolsRow.count : '0',
      contractsCount: contractsRow ? contractsRow.count : '0',
      portfoliosCount: portfoliosRow ? portfoliosRow.count : '0',
      walletsCount: walletsRow ? walletsRow.count : '0',
      trackedUSD: trackedRow ? trackedRow.usd : '0',
    }),
  );

  return process.done();
};
