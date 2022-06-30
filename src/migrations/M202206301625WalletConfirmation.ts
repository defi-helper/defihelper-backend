import { SchemaBuilder } from 'knex';
import { walletBlockchainTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(walletBlockchainTableName, (table) => {
    table.boolean('confirmed').notNullable().defaultTo(true);
  });
};
