import { tokenPartTableName, tokenTableName } from '@models/Token/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(tokenPartTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('parent', 36).notNullable().index();
    table.string('child', 36).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${tokenPartTableName}_pkey`);
    table
      .foreign('parent')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('child')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
