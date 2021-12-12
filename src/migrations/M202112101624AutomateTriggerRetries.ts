import { SchemaBuilder } from 'knex';
import { triggerTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(triggerTableName, (table) => {
    table.integer('retries', 1).notNullable().defaultTo(0);
  });
};
