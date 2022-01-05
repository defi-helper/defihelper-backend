import { SchemaBuilder } from 'knex';
import { tableName as walletTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(walletTableName, (table) => {
    table.enum('suspendReason', ['lowFunds']).nullable();
  });
};
