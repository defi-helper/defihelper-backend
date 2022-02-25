import { proposalTableName, tagTableName } from '@models/Proposal/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(tagTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('proposal', 36).notNullable().index();
    table.string('user', 36).notNullable().index();
    table.string('tag', 128).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tagTableName}_pkey`);
    table
      .foreign('proposal')
      .references(`${proposalTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
