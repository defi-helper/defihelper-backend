import { SchemaBuilder } from 'knex';
import { actionTableName, conditionTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(actionTableName, (table) => {
    table.dropColumn('skipReason');
  });
  await schema.alterTable(conditionTableName, (table) => {
    table.dropColumn('restakeAt');
  });
};
