import { SchemaBuilder } from 'knex';
import { userNotificationTableName } from '@models/UserNotification/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(userNotificationTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable();
    table.string('type', 32).notNullable().index();
    table.dateTime('createdAt').notNullable();

    table.primary(['id'], `${userNotificationTableName}_pkey`);
    table.unique(['user', 'type'], `${userNotificationTableName}_uniqkey`);
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
