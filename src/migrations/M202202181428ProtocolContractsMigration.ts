import { SchemaBuilder } from 'knex';
import container from '@container';
import { protocolTableName } from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  const database = container.database();

  await database.raw(`
    DELETE FROM public.protocol T1
        USING public.protocol   T2
    WHERE
        T1."createdAt" < T2."createdAt"
            AND
        T1."debankId" IS NOT NULL;
  `);

  return schema.alterTable(protocolTableName, (table) => {
    table.unique(['debankId']);
  });
};
