import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.string('layout', 64).notNullable().defaultTo('');
  });
};
