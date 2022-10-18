import { SchemaBuilder } from 'knex';
import { tableName } from '@models/Queue/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tableName, (table) => {
    table.integer('attempt').notNullable().defaultTo(0);
  });
};
