import { SchemaBuilder } from 'knex';
import { transferTableName } from '@models/Billing/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(transferTableName, (table) => {
    table.boolean('confirmed').index().notNullable().defaultTo(false);
    table.dateTime('updatedAt').notNullable().defaultTo('2021-12-23 16:15:00');
  });
};
