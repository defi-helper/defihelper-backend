import { SchemaBuilder } from 'knex';
import { userNotificationTableName } from '@models/UserNotification/Entity';
import { userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .alterTable(userTableName, (table) => {
      table.string('timezone', 10).notNullable().defaultTo('Europe/Moscow');
    })
    .alterTable(userNotificationTableName, (table) => {
      table.string('user').nullable().alter();
      table.string('contact').nullable();
      table.time('time').notNullable().defaultTo('12:00');

      table.foreign('contact').references(`${userContactTableName}.id`);
    });
};
