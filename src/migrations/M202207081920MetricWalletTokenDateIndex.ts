import { SchemaBuilder } from 'knex';
import { metricWalletTokenTableName } from '@models/Metric/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(metricWalletTokenTableName, (table) => {
    table.index('date', 'metric_wallet_token_date_index');
  });
};
