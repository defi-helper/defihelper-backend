import { SchemaBuilder } from 'knex';
import {
  metricContractRegistryTableName,
  metricTokenRegistryTableName,
} from '@models/Metric/Entity';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricContractRegistryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('token', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.primary(['id'], `${metricTokenRegistryTableName}_pkey`);
    table.unique(['token'], `${metricTokenRegistryTableName}_uniq`);
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
