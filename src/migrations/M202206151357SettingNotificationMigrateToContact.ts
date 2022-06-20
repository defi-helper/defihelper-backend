import { SchemaBuilder } from 'knex';
import { userNotificationTableName } from '@models/UserNotification/Entity';
import { userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .alterTable(userTableName, (table) => {
      table.string('timezone', 10).notNullable().defaultTo('Atlantic/Reykjavik');
    })
    .alterTable(userNotificationTableName, (table) => {
      table.string('contact').nullable();
      table.time('time').notNullable().defaultTo('12:00');

      table
        .foreign('contact')
        .references(`${userContactTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

      table.dropUnique(['user', 'type'], `${userNotificationTableName}_uniqkey`);
    });
};
