import { SchemaBuilder } from 'knex';
import { TokenCreatedBy, tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(tokenTableName, (table) => {
    table.string('createdBy', 64).index().notNullable().defaultTo(TokenCreatedBy.Manualy);
  });
};
