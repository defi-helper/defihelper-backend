import { SchemaBuilder } from 'knex';
import { tableName } from '@models/Queue/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(tableName, (table) => {
    table.dropColumn('collisionSign');
  });
};
