import { SchemaBuilder } from 'knex';
import { contractTableName, protocolTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  schema
    .alterTable(protocolTableName, (table) => {
      table.jsonb('metric').notNullable().defaultTo('{}');
      table.string('debankId', 64).nullable();
    })
    .raw('ALTER TABLE protocol DROP CONSTRAINT "protocol_adapter_unique";')
    .alterTable(contractTableName, (table) => {
      table.string('debankAddress', 64).nullable();
    });
};
