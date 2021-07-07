import { SchemaBuilder } from 'knex';
import { tableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(tableName, (table) => {
    table.string('locale', 32).notNullable().defaultTo('enUS');
  });
};
