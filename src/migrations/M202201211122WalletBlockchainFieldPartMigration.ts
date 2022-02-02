import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  const database = container.database();

  await database.raw(`
    insert into wallet_blockchain (id, type, blockchain, network, "publicKey", address)
      select
          rootWallet.id, rootWallet.type, rootWallet.blockchain, rootWallet.network, rootWallet."publicKey", rootWallet.address
      from wallet AS rootWallet
  `);
  return schema.alterTable(walletTableName, (table) => {
    table.dropColumn('type');
    table.dropColumn('blockchain');
    table.dropColumn('network');
    table.dropColumn('publicKey');
    table.dropColumn('address');
  });
};
