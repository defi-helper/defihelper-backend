import { SchemaBuilder } from 'knex';
import { protocolIdentifierTableName, protocolTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  schema
    .alterTable(protocolTableName, (table) => {
      table.jsonb('metric').notNullable().defaultTo('{}');
    })
    .raw('ALTER TABLE protocol DROP CONSTRAINT "protocol_adapter_unique";')
    .createTable(protocolIdentifierTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('identifier', 64).notNullable().index();

      table.index(['identifier']);
      table
        .foreign('id')
        .references(`${protocolTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
