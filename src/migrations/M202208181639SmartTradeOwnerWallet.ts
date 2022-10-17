import container from '@container';
import { smartTradeOrderTableName } from '@models/SmartTrade/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { SchemaBuilder } from 'knex';

export default async (schema: SchemaBuilder) => {
  await container.model.smartTradeOrderTable().delete();
  return schema.alterTable(smartTradeOrderTableName, (table) => {
    table.string('owner', 36).alter();
    table.dropColumn('blockchain');
    table.dropColumn('network');
    table
      .foreign('owner')
      .references(`${walletTableName}.id`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE');
  });
};
