import { SchemaBuilder } from 'knex';
import { metricContractTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(metricContractTableName, (table) => {
    table.dateTime('date').notNullable().defaultTo('2021-06-30 13:59:00');
  });
};
