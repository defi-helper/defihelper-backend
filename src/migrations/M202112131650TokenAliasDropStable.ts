import { SchemaBuilder } from 'knex';
import { tokenAliasTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(tokenAliasTableName, (table) => {
    table.dropColumn('stable');
  });
};
