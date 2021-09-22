import { SchemaBuilder } from 'knex';
import { metricBlockchainTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(metricBlockchainTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('blockchain', 64).notNullable();
    table.string('network', 64).notNullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricBlockchainTableName}_pkey`);
  });
};
