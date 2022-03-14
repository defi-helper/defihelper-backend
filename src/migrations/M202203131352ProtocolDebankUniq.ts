import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  const database = container.database();
  await database.raw(`
    DELETE FROM ${protocolTableName} T1
        USING ${protocolTableName}   T2
    WHERE
        T1."createdAt" < T2."createdAt"
            AND
        T1."adapter" = 'debankByApiReadonly';
  `);

  return schema.alterTable(protocolTableName, (table) => {
    return table.unique(['debankId']);
  });
};
