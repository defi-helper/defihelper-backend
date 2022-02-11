import { SchemaBuilder } from 'knex';
import { productTableName, purchaseTableName } from '@models/Store/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(productTableName, (table) => {
      table.string('id', 36).notNullable();
      table.integer('number').notNullable();
      table.string('code', 64).notNullable();
      table.string('name', 512).notNullable();
      table.string('description', 512).notNullable().defaultTo('');
      table.float('priceUSD').notNullable();
      table.integer('amount').notNullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${productTableName}_pkey`);
      table.unique(['number', 'code']);
    })
    .createTable(purchaseTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('product', 36).notNullable().index();
      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('account', 512).notNullable();
      table.integer('amount').notNullable();
      table.string('tx', 512).notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${purchaseTableName}_pkey`);
      table
        .foreign('product')
        .references(`${productTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
      table.index(['blockchain', 'network', 'account']);
    });
};
