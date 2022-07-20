import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { metricWalletTokenRegistryTableName } from '@models/Metric/Entity';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricWalletTokenRegistryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).nullable().index();
    table.string('wallet', 36).notNullable().index();
    table.string('token', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.primary(['id'], `${metricWalletTokenRegistryTableName}_pkey`);
    table.unique(['contract', 'wallet', 'token'], `${metricWalletTokenRegistryTableName}_uniq`);
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
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
