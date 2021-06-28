import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import { proposalTableName } from '@models/Proposal/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(proposalTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('author', 36).nullable();
    table.string('title', 512).notNullable();
    table.text('description').notNullable();
    table.string('status', 64).notNullable().index();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${proposalTableName}_pkey`);
    table
      .foreign('author')
      .references(`${userTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};
