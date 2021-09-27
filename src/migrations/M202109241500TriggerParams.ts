import { triggerTableName } from '@models/Automate/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(triggerTableName, (table) => {
    table.jsonb('params').notNullable().defaultTo('{}');
  });
};
