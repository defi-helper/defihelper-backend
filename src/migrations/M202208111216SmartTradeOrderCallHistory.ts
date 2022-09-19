import { SchemaBuilder } from 'knex';
import {
  smartTradeOrderCallHistoryTableName,
  smartTradeOrderTableName,
} from '@models/SmartTrade/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(smartTradeOrderCallHistoryTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('order', 36).notNullable().index();
    table.string('tx', 512).nullable();
    table.string('status', 32).notNullable().index();
    table.text('error').notNullable().defaultTo('');
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.primary(['id'], `${smartTradeOrderCallHistoryTableName}_pkey`);
    table
      .foreign('order')
      .references(`${smartTradeOrderTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
