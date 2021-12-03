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
    FROM token AS tkn, wallet as wlt
      WHERE tkn.address = mwt."tokenAddress" AND wlt.blockchain = tkn.blockchain
  `);

  schema.alterTable(metricWalletTokenTableName, (table) => {
    table.dropColumn('tokenAddress');
  });

  schema.alterTable(metricWalletTokenTableName, (table) => {
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  schema.alterTable(tokenAliasTableName, (table) => {
    table.string('protocol', 36).nullable();

    table
      .foreign('protocol')
      .references(`${protocolTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });

  return schema.raw(
    `alter table ${metricWalletTokenTableName} alter column contract drop not null`,
  );
};
