import { SchemaBuilder } from 'knex';
import { tokenTableName, tokenAliasTableName } from '@models/Token/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(tokenAliasTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('name', 512).notNullable();
      table.string('symbol', 64).notNullable();
      table.boolean('stable').notNullable().index();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${tokenAliasTableName}_pkey`);
    })
    .createTable(tokenTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('alias', 36).nullable().index();
      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('address', 512).notNullable();
      table.string('name', 512).notNullable();
      table.string('symbol', 64).notNullable();
      table.integer('decimals').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${tokenTableName}_pkey`);
      table
        .foreign('alias')
        .references(`${tokenAliasTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('SET NULL');
    });
};
