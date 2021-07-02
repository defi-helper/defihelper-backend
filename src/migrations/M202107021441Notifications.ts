import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';
import {
    ContactBroker,
    contactTableName,
    NotificationStatus,
    notificationTableName,
    NotificationType, subscriptionTableName, webHookTableName
} from "@models/Notification/Entity";
import { tableName } from "@models/Queue/Entity";
import { contractTableName } from "@models/Protocol/Entity";

export default async (schema: SchemaBuilder) => {
  await schema.createTable(contactTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable();
    table
        .enum(
            'broker',
            [
              ContactBroker.Email,
              ContactBroker.Telegram,
            ],
            {
              useNative: true,
              enumName: `${tableName}_broker_enum`,
            },
        )
        .notNullable()
        .index();
    table.string('address', 1024).notNullable();
    table.string('confirmationCode', 36).notNullable();
    table.dateTime('createdAt').notNullable();
    table.dateTime('activatedAt').nullable();

    table.primary(['id'], `${contactTableName}_pkey`);
    table
        .foreign('user')
        .references(`${userTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
  });

  await schema.createTable(notificationTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contact', 36).notNullable();
    table
      .enum(
        'event',
        [
          NotificationType.event,
        ],
        {
          useNative: true,
          enumName: `${notificationTableName}_event_enum`,
        },
      )
      .notNullable()
      .index();
    table.jsonb('payload').notNullable();
    table
      .enum(
        'status',
        [
          NotificationStatus.new,
          NotificationStatus.processed,
        ],
        {
          useNative: true,
          enumName: `${notificationTableName}_status_enum`,
        },
      )
      .notNullable()
      .index();
    table.dateTime('createdAt').notNullable();
    table.dateTime('processedAt').nullable();

    table.primary(['id'], `${notificationTableName}_pkey`);
    table
      .foreign('contact')
      .references(`${contactTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  await schema.createTable(webHookTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable();
    table.string('event', 256).notNullable();


    table.primary(['id'], `${webHookTableName}_pkey`);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });

  await schema.createTable(subscriptionTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable();
    table.string('webHook', 36).notNullable();
    table.string('contact', 36).notNullable();
    table.dateTime('createdAt').notNullable();


    table.primary(['id'], `${subscriptionTableName}_pkey`);
    table
      .foreign('user')
      .references(`${userTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('webHook')
      .references(`${webHookTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('contact')
      .references(`${contactTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
