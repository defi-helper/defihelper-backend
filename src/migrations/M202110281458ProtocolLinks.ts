import { protocolTableName } from '@models/Protocol/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(protocolTableName, (table) => {
    table.jsonb('links').notNullable().defaultTo('{}');
  });
};
