import { SchemaBuilder } from 'knex';
import { contractBlockchainTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractBlockchainTableName, (table) => {
    table.dropColumn('metric');
  });
};
