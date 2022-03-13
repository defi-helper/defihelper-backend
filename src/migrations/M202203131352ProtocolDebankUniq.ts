import { SchemaBuilder } from 'knex';
import { protocolTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  await database.raw(`
    DELETE FROM ${protocolTableName} T1
        USING ${protocolTableName}   T2
    WHERE
        T1."createdAt" < T2."createdAt"
            AND
        T1."debankId" IS NOT NULL;
  `);

  return schema.alterTable(protocolTableName, (table) => {
    return table.unique(['debankId']);
  });
};
