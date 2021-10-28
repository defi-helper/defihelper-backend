import { contractTableName } from '@models/Protocol/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.jsonb('automate').notNullable().defaultTo('{"adapters": []}');
  });
};
