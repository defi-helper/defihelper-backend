import { SchemaBuilder } from 'knex';
import { tokenTableName } from '@models/Token/Entity';
import { contractTableName, tokenContractLinkTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(tokenContractLinkTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('token', 36).notNullable().index();
    table.string('type', 64).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tokenContractLinkTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('token')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
