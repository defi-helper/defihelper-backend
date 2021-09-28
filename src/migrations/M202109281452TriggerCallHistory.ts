import { SchemaBuilder } from 'knex';
import { triggerCallHistoryTableName, triggerTableName } from '@models/Automate/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(triggerCallHistoryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('trigger', 36).notNullable();
    table.text('error').nullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${triggerCallHistoryTableName}_pkey`);
    table
      .foreign('trigger')
      .references(`${triggerTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
