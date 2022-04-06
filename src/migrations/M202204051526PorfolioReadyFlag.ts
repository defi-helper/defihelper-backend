import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userTableName, (table) => {
    table.boolean('isPorfolioCollected').notNullable().defaultTo(true);
  });
};
