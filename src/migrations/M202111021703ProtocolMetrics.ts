import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';
import { metricProtocolTableName } from '@models/Metric/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(metricProtocolTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('protocol', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.dateTime('date').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${metricProtocolTableName}_pkey`);
    table
      .foreign('protocol')
      .references(`${protocolTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
