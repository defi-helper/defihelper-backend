import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.raw('ALTER TABLE wallet DROP CONSTRAINT "wallet_suspendReason_check";');
};
