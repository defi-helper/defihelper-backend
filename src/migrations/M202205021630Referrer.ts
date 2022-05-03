import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userTableName, (table) => {
    table.string('referrer', 36).nullable();
    table.foreign('referrer').references(`${userTableName}.id`);
  });
};
