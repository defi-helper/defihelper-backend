import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(walletTableName, (table) => {
    table.dateTime('deletedAt').nullable().index();
  });
};
