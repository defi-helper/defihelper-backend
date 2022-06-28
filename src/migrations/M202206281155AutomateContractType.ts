import { SchemaBuilder } from 'knex';
import { contractTableName, ContractType } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.string('type', 256).notNullable().index().defaultTo(ContractType.Autorestake);
  });
};
