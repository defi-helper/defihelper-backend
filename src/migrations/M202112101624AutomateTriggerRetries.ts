import { SchemaBuilder } from 'knex';
import { triggerTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(triggerTableName, (table) => {
    table.integer('retries').notNullable().defaultTo(0);
  });
};
