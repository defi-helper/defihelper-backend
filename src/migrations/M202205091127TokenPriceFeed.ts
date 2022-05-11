import { SchemaBuilder } from 'knex';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tokenTableName, (table) => {
    table.jsonb('priceFeed').nullable().defaultTo(null).index();
  });
};