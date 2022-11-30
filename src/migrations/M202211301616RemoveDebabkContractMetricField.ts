import { SchemaBuilder } from 'knex';
import { contractDebankTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractDebankTableName, (table) => {
    table.dropColumn('metric');
  });
};
