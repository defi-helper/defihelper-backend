import { SchemaBuilder } from 'knex';
import { investHistoryTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(investHistoryTableName, (table) => {
    table.string('tx', 512).notNullable().defaultTo('').index();
    table.boolean('confirmed').notNullable().defaultTo(true).index();
  });
};
