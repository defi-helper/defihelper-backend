import { SchemaBuilder } from 'knex';
import { metricWalletRegistryTableName, RegistryPeriod } from '@models/Metric/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await container.database().raw(`
    ALTER TABLE ${metricWalletRegistryTableName} DROP CONSTRAINT metric_wallet_registry_contract_wallet_uniq;
  `);

  return schema.alterTable(metricWalletRegistryTableName, (table) => {
    table.string('period', 32).notNullable().index().defaultTo(RegistryPeriod.Latest);
  });
};
