import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(contractTableName, (table) => {
    table.jsonb('metric').notNullable().defaultTo(JSON.stringify({}));
  });
};
