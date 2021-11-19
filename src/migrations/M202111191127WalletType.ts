import { tableName, WalletType } from '@models/Wallet/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(tableName, (table) => {
    table
      .enum('type', [WalletType.Wallet, WalletType.Contract], {
        useNative: true,
        enumName: `${tableName}_type_enum`,
      })
      .notNullable()
      .index()
      .defaultTo(WalletType.Wallet);
  });
};
