import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.createTable('test', (table) => {
    table.string('id', 36).notNullable();
  });
};
