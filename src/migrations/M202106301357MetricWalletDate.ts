import { SchemaBuilder } from 'knex';
import { metricWalletTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(metricWalletTableName, (table) => {
    table.dateTime('date').notNullable().defaultTo('2021-06-30 13:59:00');
  });
};
