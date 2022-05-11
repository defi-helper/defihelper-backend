import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';

export default (schema: SchemaBuilder) => {
  return schema.alterTable(walletTableName, (table) => {
    table.dateTime('statisticsCollectedAt').defaultTo('2022-05-11 12:00:00').notNullable();
  });
};
