import { SchemaBuilder } from 'knex';
import { metadataTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(metadataTableName, (table) => {
    table.string('blockchain', 64).nullable();
    table.string('network', 64).nullable();
    table.string('address', 512).nullable();
    table.string('contract').nullable().alter();

    table.index(['blockchain', 'network', 'address']);
    table.unique(['blockchain', 'network', 'address', 'type']);
  });
};
