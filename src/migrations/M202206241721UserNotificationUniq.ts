import { SchemaBuilder } from 'knex';
import { userNotificationTableName } from '@models/UserNotification/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await container.database().raw(`
    delete from user_notification t
    where exists (
      select 1 from user_notification
      where contact = t.contact and type = t.type and id != t.id
    )
  `);

  return schema.createTable(userNotificationTableName, (table) => {
    table.unique(['contact', 'type'], `${userNotificationTableName}_uniqkey`);
  });
};
