import { SchemaBuilder } from 'knex';
import { transferTableName } from '@models/Billing/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(transferTableName, (table) => {
    table.double('amount').alter();
  });
};
