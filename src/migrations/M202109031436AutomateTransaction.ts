import { SchemaBuilder } from 'knex';
import { contractTableName, transactionTableName } from '@models/Automate/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(transactionTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.string('consumer', 512).notNullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.boolean('confirmed').notNullable().defaultTo(false).index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${transactionTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
