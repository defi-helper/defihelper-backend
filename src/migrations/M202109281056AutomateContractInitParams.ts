import { contractTableName } from '@models/Automate/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.jsonb('initParams').notNullable().defaultTo('{}');
  });
};
