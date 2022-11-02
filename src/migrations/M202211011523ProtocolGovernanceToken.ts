import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';
import { tokenTableName } from '@models/Token/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(protocolTableName, (table) => {
    table.string('governanceToken', 36).nullable().index();
    table
      .foreign('governanceToken')
      .references(`${tokenTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
