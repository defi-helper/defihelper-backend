import { SchemaBuilder } from 'knex';
import { conditionTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(conditionTableName, (table) => {
    table.dateTime('restakeAt').nullable();
  });
};
