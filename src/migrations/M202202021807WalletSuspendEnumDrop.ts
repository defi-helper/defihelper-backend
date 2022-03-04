import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.raw('ALTER TABLE wallet DROP CONSTRAINT IF EXISTS "wallet_suspendReason_check";');
};
