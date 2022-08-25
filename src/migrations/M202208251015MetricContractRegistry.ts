import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Protocol/Entity';
import { metricContractRegistryTableName } from '@models/Metric/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricContractRegistryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).nullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.primary(['id'], `${metricContractRegistryTableName}_pkey`);
    table.unique(['contract'], `${metricContractRegistryTableName}_uniq`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
