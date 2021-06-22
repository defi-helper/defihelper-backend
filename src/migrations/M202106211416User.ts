import { SchemaBuilder } from 'knex';
import { tableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(tableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('role', 512).notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tableName}_pkey`);
  });
};
