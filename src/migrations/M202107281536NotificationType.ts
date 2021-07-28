import { SchemaBuilder } from 'knex';
import { notificationTableName } from '@models/Notification/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(notificationTableName, (table) => {
    table.renameColumn('event', 'type');
  });
};
