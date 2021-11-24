import { contractTableName as protocolContractTableName } from '@models/Protocol/Entity';
import { contractTableName } from '@models/Automate/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.string('contract', 36).nullable().defaultTo(null);
    table
      .foreign('contract')
      .references(`${protocolContractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('SET NULL');
  });
};
