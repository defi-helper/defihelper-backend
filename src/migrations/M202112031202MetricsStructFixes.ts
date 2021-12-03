import { SchemaBuilder } from 'knex';
import { tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { metricWalletTokenTableName } from '@models/Metric/Entity';
import { protocolTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  schema
    .alterTable(metricWalletTokenTableName, (table) => {
      table.renameColumn('token', 'tokenAddress');
    })
    .toQuery();

  schema
    .alterTable(metricWalletTokenTableName, (table) => {
      table.string('token', 36);
    })
    .toQuery();

  schema.raw(`
    UPDATE metric_wallet_token as mwt
        SET token = tkn.id
    FROM token AS tkn
        WHERE tkn.address = mwt."tokenAddress"
  `);

  schema.alterTable(metricWalletTokenTableName, (table) => {
    table.dropColumn('tokenAddress');
  });

  schema.raw(
    `CREATE UNIQUE INDEX metric_wallet_token_token_uniq ON ${metricWalletTokenTableName} (token)`,
  );
  schema.alterTable(metricWalletTokenTableName, (table) => {
    table
      .foreign(tokenTableName)
      .references(`${metricWalletTokenTableName}.token`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  schema.raw(
    `CREATE UNIQUE INDEX token_alias_protocol_protocol_uniq ON ${tokenAliasTableName} (protocol)`,
  );
  schema.raw('alter table token_alias alter column protocol drop not null');
  schema.alterTable(tokenAliasTableName, (table) => {
    table.string('protocol', 36).nullable().alter();

    table
      .foreign(protocolTableName)
      .references(`${tokenAliasTableName}.protocol`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  return schema.raw(
    `alter table ${metricWalletTokenTableName} alter column contract drop not null`,
  );
};
