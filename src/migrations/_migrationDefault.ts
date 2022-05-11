import { SchemaBuilder } from 'knex';
import { tableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(tableName, (table) => {
    table.string('id', 36).notNullable();
  });
};
