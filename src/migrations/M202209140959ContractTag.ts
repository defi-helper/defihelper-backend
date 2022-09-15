import { SchemaBuilder } from 'knex';
import { tagTableName } from '@models/Tag/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(tagTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('name', 64).notNullable().unique();
    table.string('type', 32).notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tagTableName}_pkey`);
  });
};
