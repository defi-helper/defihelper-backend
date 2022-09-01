import { SchemaBuilder } from 'knex';
import { contractTableName, contractStopLossTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(contractStopLossTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.jsonb('stopLoss').notNullable().defaultTo('{}');
    table.string('status', 64).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.primary(['id'], `${contractStopLossTableName}_pkey`);
    table.unique(['contract'], `${contractStopLossTableName}_uniq`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
