import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';
import { postTableName } from '@models/Protocol/Social/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(postTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('protocol', 36).notNullable().index();
    table.string('provider', 64).notNullable();
    table.string('title', 512).notNullable();
    table.text('content').notNullable();
    table.string('link', 2048).notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${postTableName}_pkey`);
    table
      .foreign('protocol')
      .references(`${protocolTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
