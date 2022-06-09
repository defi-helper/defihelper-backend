import { SchemaBuilder } from 'knex';
import { metadataTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(metadataTableName, (table) => {
    table.string('blockchain').notNullable().alter();
    table.string('network', 64).notNullable().alter();
    table.string('address', 512).notNullable().alter();

    table.dropColumn('contract');
  });
};
