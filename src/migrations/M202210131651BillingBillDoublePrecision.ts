import { SchemaBuilder } from 'knex';
import { billTableName } from '@models/Billing/Entity';

export default async (schema: SchemaBuilder) => {
  return schema.alterTable(billTableName, (table) => {
    table.double('claimGasFee').alter();
    table.double('claimProtocolFee').alter();
    table.double('gasFee').alter();
    table.double('protocolFee').alter();
    table.double('claim').alter();
  });
};
