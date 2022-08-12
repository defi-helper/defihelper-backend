import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(protocolTableName, (table) => {
    table.index('adapter', `${protocolTableName}_adapter_index`);
  });
};
