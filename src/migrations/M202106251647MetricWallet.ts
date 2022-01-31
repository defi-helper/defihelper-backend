import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { metricWalletTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(metricWalletTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.string('wallet', 36).notNullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricWalletTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('wallet')
      .references(`${walletTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
