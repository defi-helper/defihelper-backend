import { SchemaBuilder } from 'knex';
import { tableName as userTableName } from '@models/User/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(userTableName, (table) => {
    table.dateTime('lastSeenAt').defaultTo('2022-07-22 12:02:00');
  });
};
