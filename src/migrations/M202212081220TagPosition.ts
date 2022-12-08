import { SchemaBuilder } from 'knex';
import { tagTableName } from '@models/Tag/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tagTableName, (table) => {
    table.integer('position').notNullable().defaultTo(0);
  });
};
