import { SchemaBuilder } from 'knex';
import { contractTableName, investHistoryTableName } from '@models/Automate/Entity';
import { walletTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(investHistoryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('wallet', 36).notNullable().index();
    table.double('amount').notNullable();
    table.double('amountUSD').notNullable();
    table.boolean('refunded').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${investHistoryTableName}_pkey`);
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
