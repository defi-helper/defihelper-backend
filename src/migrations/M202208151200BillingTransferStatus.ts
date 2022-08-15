import { SchemaBuilder } from 'knex';
import { TransferStatus, transferTableName } from '@models/Billing/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  await schema.alterTable(transferTableName, (table) => {
    table.string('status', 36).notNullable().index().defaultTo(TransferStatus.Pending);
    table.text('rejectReason').notNullable().defaultTo('');
  });
  await container.model
    .billingTransferTable()
    .update('status', TransferStatus.Confirmed)
    .where('confirmed', true);
  await schema.alterTable(transferTableName, (table) => {
    table.dropColumn('confirmed');
  });
};
