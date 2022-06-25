import { SchemaBuilder } from 'knex';
import { actionTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(actionTableName, (table) => {
    table.string('skipReason', 256).nullable().index();
  });
};
