import { SchemaBuilder } from 'knex';
import { contractRebalanceTableName, contractRebalanceTxTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.createTable(contractRebalanceTxTableName, (table) => {
    table.string('id', 36).notNullable();
    table.string('rebalance', 36).notNullable().index();
    table.string('tx', 512).notNullable().defaultTo('');
    table.string('status', 36).notNullable().index();
    table.text('error').notNullable();
    table.dateTime('updatedAt').notNullable();
    table.dateTime('createdAt').notNullable();
    table.primary(['id'], `${contractRebalanceTxTableName}_pkey`);
    table
      .foreign('rebalance')
      .references(`${contractRebalanceTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
