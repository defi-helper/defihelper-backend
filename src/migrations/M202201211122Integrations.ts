import { SchemaBuilder } from 'knex';
import {
  walletBlockchainTableName,
  walletExchangeTableName,
  walletTableName,
} from '@models/Wallet/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .createTable(walletBlockchainTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('address', 512).notNullable();
      table.string('publicKey', 512).notNullable();

      table.primary(['id'], `${walletBlockchainTableName}_fk_pk`);
      table.unique(['blockchain', 'network', 'address']);
      table
        .foreign('id')
        .references(`${walletTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })

    .createTable(walletExchangeTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('type', 25).notNullable();
      table.text('payload').notNullable();

      table.primary(['id'], `${walletExchangeTableName}_fk_pk`);
      table.unique(['id', 'type']);
      table
        .foreign('id')
        .references(`${walletTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
