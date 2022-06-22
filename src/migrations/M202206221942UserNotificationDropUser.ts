import { SchemaBuilder } from 'knex';
import { userNotificationTableName } from '@models/UserNotification/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userNotificationTableName, (table) => {
    table.dropColumn('user');
  });
};
