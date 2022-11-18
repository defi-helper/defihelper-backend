import container from '@container';
import { metricWalletTokenRegistryTableName, RegistryPeriod } from '@models/Metric/Entity';
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
    container.model
      .metricWalletTokenRegistryTable()
      .column(
        database.raw(
          `SUM((COALESCE(${metricWalletTokenRegistryTableName}.data->>'usd', '0'))::numeric) AS usd`,
        ),
      )
      .innerJoin(
        tokenTableName,
        `${metricWalletTokenRegistryTableName}.token`,
        `${tokenTableName}.id`,
      )
      .innerJoin(tokenAliasTableName, `${tokenTableName}.alias`, `${tokenAliasTableName}.id`)
      .where(function () {
        this.where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest);
        this.whereIn(`${tokenAliasTableName}.liquidity`, [
          TokenAliasLiquidity.Stable,
          TokenAliasLiquidity.Unstable,
        ]);
        this.where(database.raw(`${metricWalletTokenRegistryTableName}.data->>'usd' != 'NaN'`));
      })
      .first(),
  ]);

  container.cache().promises.setex(
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
