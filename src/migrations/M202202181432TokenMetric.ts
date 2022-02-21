import { SchemaBuilder } from 'knex';
import { metricTokenTableName } from '@models/Metric/Entity';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(metricTokenTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('token', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricTokenTableName}_pkey`);
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
