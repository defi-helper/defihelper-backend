import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userTableName, (table) => {
    table.string('name', 512).notNullable().defaultTo('');
  });
};
