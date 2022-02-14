import { SchemaBuilder } from 'knex';
import { contractTableName, walletContractLinkTableName } from '@models/Protocol/Entity';
import { walletTableName } from '@models/Wallet/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(walletContractLinkTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('contract', 36).notNullable().index();
    table.string('wallet', 36).notNullable().index();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${walletContractLinkTableName}_pkey`);
    table.unique(['contract', 'wallet']);
    table
      .foreign('contract')
      .references(`${contractTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
    table
      .foreign('wallet')
      .references(`${walletTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
