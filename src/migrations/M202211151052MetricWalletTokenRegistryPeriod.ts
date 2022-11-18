import { SchemaBuilder } from 'knex';
import { metricWalletTokenRegistryTableName, RegistryPeriod } from '@models/Metric/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await container.database().raw(`
    ALTER TABLE ${metricWalletTokenRegistryTableName} DROP CONSTRAINT metric_wallet_token_registry_uniq;
  `);

  return schema.alterTable(metricWalletTokenRegistryTableName, (table) => {
    table.string('period', 32).notNullable().index().defaultTo(RegistryPeriod.Latest);
  });
};
