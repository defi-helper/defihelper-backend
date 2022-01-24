import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';
import { tableName as userTableName } from '@models/User/Entity';

export default (schema: SchemaBuilder) => {
  return schema.createTable(walletTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('user', 36).notNullable();
    table.string('blockchain', 64).notNullable();
    table.string('network', 64).notNullable();
    table.string('address', 512).notNullable();
    table.string('publicKey', 512).notNullable();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${walletTableName}_pkey`);
    table.unique(['blockchain', 'network', 'address']);
    table.foreign('user').references(`${userTableName}.id`).onUpdate('CASCADE').onDelete('CASCADE');
  });
};
