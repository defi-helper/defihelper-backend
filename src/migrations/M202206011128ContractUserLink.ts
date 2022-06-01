import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import { contractTableName, userContractLinkTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(userContractLinkTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('user', 36).notNullable().index();
    table.string('type', 64).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${userContractLinkTableName}_pkey`);
    table.unique(['contract', 'user', 'type']);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
