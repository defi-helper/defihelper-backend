import { SchemaBuilder } from 'knex';
import { tokenAliasTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tokenAliasTableName, (table) => {
    table.string('logoUrl', 512).nullable();
  });
};
