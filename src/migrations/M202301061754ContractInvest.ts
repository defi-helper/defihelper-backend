import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.boolean('invest').notNullable().defaultTo(false);
  });
};
