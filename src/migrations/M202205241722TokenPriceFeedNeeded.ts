import { SchemaBuilder } from 'knex';
import { tokenTableName } from '@models/Token/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(tokenTableName, (table) => {
    table.boolean('priceFeedNeeded').defaultTo(false).index();
  });
};
