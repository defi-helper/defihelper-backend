import { SchemaBuilder } from 'knex';
import { protocolUserFavoriteTableName, protocolTableName } from '@models/Protocol/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(protocolUserFavoriteTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('protocol', 36).notNullable().index();
    table.string('user', 36).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${protocolUserFavoriteTableName}_pkey`);
    table.unique(['protocol', 'user']);
    table
      .foreign('protocol')
      .references(`${protocolTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
