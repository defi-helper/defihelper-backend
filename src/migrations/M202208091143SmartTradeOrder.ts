import { SchemaBuilder } from 'knex';
import { tableName as queueTableName } from '@models/Queue/Entity';
import { smartTradeOrderTableName } from '@models/SmartTrade/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(smartTradeOrderTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('blockchain', 64).notNullable().index();
    table.string('network', 64).notNullable().index();
    table.string('number', 64).notNullable();
    table.string('owner', 512).notNullable().index();
    table.string('handler', 512).notNullable().index();
    table.string('type', 64).notNullable().index();
    table.jsonb('callData').notNullable();
    table.string('callDataRaw', 1024).notNullable();
    table.string('status', 64).notNullable().index();
    table.string('tx', 512).notNullable();
    table.boolean('confirmed').notNullable().index();
    table.string('statusTask', 36).nullable().index();
    table.string('watcherListenerId', 36).nullable().index();
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.primary(['id'], `${smartTradeOrderTableName}_pkey`);
    table.unique(['blockchain', 'network', 'number'], `${smartTradeOrderTableName}_order_uniq`);
    table
      .foreign('statusTask')
      .references(`${queueTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
