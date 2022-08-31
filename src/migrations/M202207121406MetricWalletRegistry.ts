import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { metricWalletRegistryTableName } from '@models/Metric/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricWalletRegistryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('wallet', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.primary(['id'], `${metricWalletRegistryTableName}_pkey`);
    table.unique(['contract', 'wallet'], `${metricWalletRegistryTableName}_contract_wallet_uniq`);
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
