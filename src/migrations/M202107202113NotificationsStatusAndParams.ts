import { SchemaBuilder } from 'knex';
import { userContactTableName, ContactStatus } from '@models/Notification/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
  .alterTable(userContactTableName, (table) => {
    table.jsonb('params');
    table
      .enum('status', [ContactStatus.Active, ContactStatus.Inactive], {
        useNative: true,
        enumName: `${userContactTableName}_status_enum`,
      })
      .notNullable()
      .index();
  });
};
