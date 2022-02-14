import { SchemaBuilder } from 'knex';
import { contractTableName, protocolTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .alterTable(protocolTableName, (table) => {
      table.jsonb('metric').notNullable().defaultTo('{}');
      table.string('debankId', 64).nullable().index();
    })
    .raw('ALTER TABLE protocol DROP CONSTRAINT "protocol_adapter_unique";')
    .alterTable(contractTableName, (table) => {
      table.string('debankAddress', 64).nullable();
    });
};
