import { SchemaBuilder } from 'knex';
import { referrerCodeTableName } from '@models/ReferrerCode/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(referrerCodeTableName, (table) => {
    table.integer('visits', 8).defaultTo(0).notNullable();
  });
};
