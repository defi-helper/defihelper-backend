import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';
import { metricContractTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(metricContractTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricContractTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
