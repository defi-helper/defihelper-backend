import { walletTableName } from '@models/Wallet/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(walletTableName, (table) => {
    table.string('name', 512).notNullable().defaultTo('');
  });
};
