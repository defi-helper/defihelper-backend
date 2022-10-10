import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import { userCollectorTableName } from '@models/Metric/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(userCollectorTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable().index();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.string('status', 64).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.primary(['id'], `${userCollectorTableName}_pkey`);
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
