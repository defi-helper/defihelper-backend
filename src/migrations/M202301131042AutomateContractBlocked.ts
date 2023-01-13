import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.dateTime('blockedAt').nullable().defaultTo(null).index();
  });
};
