import { SchemaBuilder } from 'knex';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import { triggerTableName, conditionTableName, actionTableName } from '@models/Automate/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(triggerTableName, (table) => {
      table.integer('id').notNullable();
      table.string('type', 64).notNullable();
      table.string('wallet', 36).notNullable();
      table.string('name', 512).notNullable();
      table.dateTime('lastCallAt').nullable();
      table.boolean('active').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${triggerTableName}_pkey`);
      table
        .foreign('wallet')
        .references(`${walletTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(conditionTableName, (table) => {
      table.integer('id').notNullable();
      table.string('trigger', 36).notNullable();
      table.string('type', 64).notNullable();
      table.jsonb('params').notNullable();
      table.integer('priority').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${conditionTableName}_pkey`);
      table
        .foreign('trigger')
        .references(`${triggerTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(actionTableName, (table) => {
      table.integer('id').notNullable();
      table.string('trigger', 36).notNullable();
      table.string('type', 64).notNullable();
      table.jsonb('params').notNullable();
      table.integer('priority').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${actionTableName}_pkey`);
      table
        .foreign('trigger')
        .references(`${triggerTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
