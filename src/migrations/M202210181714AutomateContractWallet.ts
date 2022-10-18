import { SchemaBuilder } from 'knex';
import { contractTableName } from '@models/Automate/Entity';
import { walletTableName } from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(contractTableName, (table) => {
    table.string('contractWallet', 36).nullable().index();
    table
      .foreign('contractWallet')
      .references(`${walletTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
