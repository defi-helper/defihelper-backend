import { SchemaBuilder } from 'knex';
import { metricContractRegistryTableName, RegistryPeriod } from '@models/Metric/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await container.database().raw(`
    ALTER TABLE ${metricContractRegistryTableName} DROP CONSTRAINT metric_contract_registry_uniq;
  `);

  return schema.alterTable(metricContractRegistryTableName, (table) => {
    table.string('period', 32).notNullable().index().defaultTo(RegistryPeriod.Latest);
  });
};
