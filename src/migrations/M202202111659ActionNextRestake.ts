import { SchemaBuilder } from 'knex';
import { actionTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(actionTableName, (table) => {
    table.dateTime('restakeAt').nullable();
  });
};
