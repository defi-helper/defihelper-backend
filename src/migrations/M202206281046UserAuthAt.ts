import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userTableName, (table) => {
    table.dateTime('authAt').notNullable().defaultTo(container.database().fn.now());
  });
};
