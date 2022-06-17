import { metricWalletTaskTableName } from '@models/Metric/Entity';
import { contractTableName } from '@models/Protocol/Entity';
import { tableName as queueTableName } from '@models/Queue/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricWalletTaskTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('wallet', 36).notNullable().index();
    table.string('task', 36).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricWalletTaskTableName}_pkey`);
    table.unique(['contract', 'task']);
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
      .foreign('task')
      .references(`${queueTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
