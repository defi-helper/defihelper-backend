import { SchemaBuilder } from 'knex';
import { logTableName } from '@models/Log/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(logTableName, (table) => {
    table.index('createdAt', `${logTableName}_created_at_index`);
  });
};
