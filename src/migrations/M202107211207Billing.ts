import { SchemaBuilder } from 'knex';
import { transferTableName, billTableName, BillStatus } from '@models/Billing/Entity';

export default (schema: SchemaBuilder) => {
  return schema
    .createTable(billTableName, (table) => {
      table.string('id', 36).notNullable();
      table.integer('number').notNullable();
      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('account', 512).notNullable();
      table.string('claimant', 512).notNullable();
      table.float('claimGasFee').notNullable();
      table.float('claimProtocolFee').notNullable();
      table.float('gasFee').nullable();
      table.float('protocolFee').nullable();
      table.float('claim').notNullable();
      table.string('description', 512).notNullable().defaultTo('');
      table
        .enum('status', [BillStatus.Pending, BillStatus.Accepted, BillStatus.Rejected], {
          useNative: true,
          enumName: `${billTableName}_status_enum`,
        })
        .notNullable()
        .index();
      table.string('tx', 512).notNullable();
      table.string('processTx', 512).nullable();
      table.dateTime('updatedAt').notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${billTableName}_pkey`);
      table.unique(['number', 'blockchain', 'network', 'account']);
    })
    .createTable(transferTableName, (table) => {
      table.string('id', 36).notNullable();
      table.string('blockchain', 64).notNullable();
      table.string('network', 64).notNullable();
      table.string('account', 512).notNullable();
      table.float('amount').notNullable();
      table.string('bill', 36).nullable();
      table.string('tx', 512).notNullable();
      table.dateTime('createdAt').notNullable();
      table.primary(['id'], `${transferTableName}_pkey`);
      table
        .foreign('bill')
        .references(`${billTableName}.id`)
        .onUpdate('CASCADE')
        .onDelete('SET NULL');
      table.index(['blockchain', 'network', 'account']);
    });
};
