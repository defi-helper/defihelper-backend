import { SchemaBuilder } from 'knex';
import { TransferStatus, transferTableName } from '@models/Billing/Entity';
import container from '@container';

export default async (schema: SchemaBuilder) => {
  console.log('migration start');

  await schema.alterTable(transferTableName, (table) => {
    table.string('status', 36).notNullable().index().defaultTo(TransferStatus.Pending);
    table.text('rejectReason').notNullable().defaultTo('');
  });
  console.log('migration alterTable complete');

  await container.model
    .billingTransferTable()
    .update('status', TransferStatus.Confirmed)
    .where('confirmed', true);

  console.log('migration update');

  await schema.alterTable(transferTableName, (table) => {
    table.dropColumn('confirmed');
  });

  console.log('migration alterTable drop');
};
