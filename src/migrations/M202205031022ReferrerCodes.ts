import { SchemaBuilder } from 'knex';
import { referrerCodeTableName } from '@models/ReferrerCode/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.createTable(referrerCodeTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable().index();
    table.string('code', 32).notNullable().unique();
    table.string('redirectTo', 512).notNullable();
    table.integer('usedTimes').notNullable().defaultTo(0);
    table.dateTime('createdAt').notNullable();

    table.primary(['id'], `${referrerCodeTableName}_pkey`);
    table.foreign('user').references(`${userTableName}`).onUpdate('CASCADE').onDelete('CASCADE');
  });

  return schema.alterTable(userTableName, (table) => {
    table.string('referrer', 36).nullable();
    table.foreign('referrer').references(`${referrerCodeTableName}.id`);
  });
};
