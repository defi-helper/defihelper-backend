import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(walletTableName, (table) => {
    table.string('suspendReason', 64).index().nullable();
  });
};
