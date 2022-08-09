import { SchemaBuilder } from 'knex';
import {
  contractMigratableRemindersBulkTableName,
  contractTableName,
} from '@models/Protocol/Entity';
import { walletTableName } from '@models/Wallet/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(contractMigratableRemindersBulkTableName, (table) => {
    table.string('id', 36).notNullable();

    table.string('wallet', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.boolean('processed').notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();

    table.unique(['wallet', 'contract'], `${contractMigratableRemindersBulkTableName}_uniq`);
    table
      .foreign('wallet')
      .references(`${walletTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');

    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
