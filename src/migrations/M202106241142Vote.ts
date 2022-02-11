import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import { proposalTableName, voteTableName } from '@models/Proposal/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(voteTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('proposal', 36).notNullable().index();
    table.string('user', 36).notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${voteTableName}_pkey`);
    table
      .foreign('proposal')
      .references(`${proposalTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
