import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(contractTableName, (table) => {
    table.dateTime('archivedAt').defaultTo(null).index();
  });
};
