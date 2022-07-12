import { SchemaBuilder } from 'knex';
import { metricWalletTableName } from '@models/Metric/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(metricWalletTableName, (table) => {
    table.index('date', 'metric_wallet_date_index');
  });
};
