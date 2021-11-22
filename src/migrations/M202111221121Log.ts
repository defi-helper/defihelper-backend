import { SchemaBuilder } from 'knex';
import { logTableName } from '@models/Log/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(logTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('source', 512).notNullable().index();
    table.text('message').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${logTableName}_pkey`);
  });
};
