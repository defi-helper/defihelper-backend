import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import {
  ContactBroker,
  userContactTableName,
  NotificationStatus,
  notificationTableName,
  NotificationType,
} from '@models/Notification/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .createTable(userContactTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('user', 36).notNullable().index();
      table
        .enum('broker', [ContactBroker.Email, ContactBroker.Telegram], {
          useNative: true,
          enumName: `${userContactTableName}_broker_enum`,
        })
        .notNullable()
        .index();
      table.string('address', 1024).notNullable();
      table.string('confirmationCode', 36).notNullable();
      table.dateTime('createdAt').notNullable();
      table.dateTime('activatedAt').nullable();

      table.primary(['id'], `${userContactTableName}_pkey`);
      table
        .foreign('user')
        .references(`${userTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })
    .createTable(notificationTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('contact', 36).notNullable().index();
      table
        .enum('event', [NotificationType.event], {
          useNative: true,
          enumName: `${notificationTableName}_event_enum`,
        })
        .notNullable()
        .index();
      table.jsonb('payload').notNullable();
      table
        .enum('status', [NotificationStatus.new, NotificationStatus.processed], {
          useNative: true,
          enumName: `${notificationTableName}_status_enum`,
        })
        .notNullable()
        .index();
      table.dateTime('createdAt').notNullable();
      table.dateTime('processedAt').nullable();

      table.primary(['id'], `${notificationTableName}_pkey`);
      table
        .foreign('contact')
        .references(`${userContactTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
