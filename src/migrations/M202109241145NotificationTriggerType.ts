import { SchemaBuilder } from 'knex';
import { notificationTableName, NotificationType } from '@models/Notification/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.raw(`
    ALTER TYPE "${notificationTableName}_event_enum"
    RENAME TO "${notificationTableName}_type_enum"
  `).raw(`
    ALTER TYPE "${notificationTableName}_type_enum"
    ADD VALUE '${NotificationType.trigger}'
  `);
};
