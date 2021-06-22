import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(protocolTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('adapter', 512).notNullable().unique();
    table.string('name', 512).notNullable();
    table.text('description').notNullable();
    table.string('icon', 512).nullable();
    table.string('link', 512).nullable();
    table.boolean('hidden').notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${protocolTableName}_pkey`);
  });
};
