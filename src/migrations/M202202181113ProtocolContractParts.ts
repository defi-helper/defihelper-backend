import { SchemaBuilder } from 'knex';
import {
  contractBlockchainTableName,
  contractDebankTableName,
  contractTableName,
} from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  return schema
    .createTable(contractDebankTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('address', 64).notNullable();
      table.jsonb('metric').notNullable().defaultTo('{}');

      table.primary(['id'], `${contractDebankTableName}_fk_pk`);
      table.unique(['address']);

      table
        .foreign('id')
        .references(`${contractTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    })

    .createTable(contractBlockchainTableName, (table) => {
      table.string('id', 36).notNullable();

      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('address', 512).notNullable();
      table.jsonb('metric').notNullable().defaultTo('{}');
      table.jsonb('automate').notNullable().defaultTo('{"adapters": []}');
      table.string('deployBlockNumber', 64).nullable();
      table.string('adapter', 512).notNullable().defaultTo('');

      table.primary(['id'], `${contractBlockchainTableName}_fk_pk`);
      table.index(['blockchain', 'network', 'address']);
      table
        .foreign('id')
        .references(`${contractTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    });
};
