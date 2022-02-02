import { walletTableName, WalletBlockchainType } from '@models/Wallet/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(walletTableName, (table) => {
    table
      .enum('type', [WalletBlockchainType.Wallet, WalletBlockchainType.Contract], {
        useNative: true,
        enumName: `${walletTableName}_type_enum`,
      })
      .notNullable()
      .index()
      .defaultTo(WalletBlockchainType.Wallet);
  });
};
