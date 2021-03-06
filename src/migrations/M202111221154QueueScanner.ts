import { tableName } from '@models/Queue/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tableName, (table) => {
    table.boolean('scanner').defaultTo(false).notNullable();
  });
};
