import { SchemaBuilder } from 'knex';
import {
  smartTradeOrderTableName,
  smartTradeOrderTokenLinkTableName,
} from '@models/SmartTrade/Entity';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(smartTradeOrderTokenLinkTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('order', 36).notNullable().index();
    table.string('token', 36).notNullable().index();
    table.string('type', 64).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${smartTradeOrderTokenLinkTableName}_pkey`);
    table.unique(['order', 'token', 'type']);
    table
      .foreign('order')
      .references(`${smartTradeOrderTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
