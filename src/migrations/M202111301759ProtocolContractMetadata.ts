import { SchemaBuilder } from 'knex';
import { contractTableName, metadataTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(metadataTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.string('type', 32).notNullable();
    table.jsonb('value').notNullable();
    table.dateTime('createdAt').notNullable();

    table.primary(['id'], `${metadataTableName}_pkey`);
    table.unique(['contract', 'type'], `${metadataTableName}_uniqkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
