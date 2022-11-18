import { SchemaBuilder } from 'knex';
import { metricTokenRegistryTableName, RegistryPeriod } from '@models/Metric/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await container.database().raw(`
    ALTER TABLE ${metricTokenRegistryTableName} DROP CONSTRAINT metric_token_registry_uniq;
  `);

  return schema.alterTable(metricTokenRegistryTableName, (table) => {
    table.string('period', 32).notNullable().index().defaultTo(RegistryPeriod.Latest);
  });
};
