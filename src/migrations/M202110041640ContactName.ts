import { userContactTableName } from '@models/Notification/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(userContactTableName, (table) => {
    table.string('name', 512).notNullable().defaultTo('');
    table.dateTime('updatedAt').notNullable().defaultTo('2021-10-04 16:40:00');
  });
};
