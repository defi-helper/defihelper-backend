import { SchemaBuilder } from 'knex';
import { transferTableName } from '@models/Billing/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(transferTableName, (table) => {
    table.dropColumn('confirmed');
  });
};
