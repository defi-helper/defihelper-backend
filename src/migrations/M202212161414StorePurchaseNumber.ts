import { SchemaBuilder } from 'knex';
import { purchaseTableName } from '@models/Store/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(purchaseTableName, (table) => {
    table.integer('number').notNullable().defaultTo(0);
  });
};
