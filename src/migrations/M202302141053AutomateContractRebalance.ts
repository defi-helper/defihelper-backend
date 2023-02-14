import { SchemaBuilder } from 'knex';
import { contractTableName, contractRebalanceTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(contractRebalanceTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('status', 36).notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${contractRebalanceTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
