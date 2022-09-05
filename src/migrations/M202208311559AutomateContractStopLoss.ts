import { SchemaBuilder } from 'knex';
import { contractTableName, contractStopLossTableName } from '@models/Automate/Entity';
import { tableName as queueTableName } from '@models/Queue/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(contractStopLossTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.jsonb('stopLoss').notNullable().defaultTo('{}');
    table.string('status', 64).notNullable().index();
    table.string('tx', 512).notNullable().defaultTo('');
    table.string('task', 36).nullable().index();
    table.text('rejectReason').notNullable();
    table.string('amountOut', 32).nullable();
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.primary(['id'], `${contractStopLossTableName}_pkey`);
    table.unique(['contract'], `${contractStopLossTableName}_uniq`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('task')
      .references(`${queueTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};
