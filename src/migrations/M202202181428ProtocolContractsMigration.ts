import { SchemaBuilder } from 'knex';
import { walletTableName } from '@models/Wallet/Entity';
import container from '@container';
import { contractBlockchainTableName, contractDebankTableName } from '@models/Protocol/Entity';
import { contractTableName } from '@models/Automate/Entity';

export default async (schema: SchemaBuilder) => {
  const database = container.database();

  await database.raw(`
    insert into ${contractBlockchainTableName} (id, blockchain, network, address, metric, automate, "deployBlockNumber", layout, adapter)
      select
          rootContract.id, rootContract.blockchain, rootContract.network, rootContract.address, rootContract.metric, rootContract.automate, rootContract."deployBlockNumber", rootContract.layout, rootContract.adapter
      from protocol_contract AS rootContract where adapter != 'debankApiReadonly'
  `);

  await database.raw(`
    insert into ${contractDebankTableName} (id, address, metric)
      select
          rootContract.id, rootContract."debankAddress", rootContract.metric
      from protocol_contract AS rootContract where adapter = 'debankApiReadonly'
    on conflict do nothing
  `);

  return schema.alterTable(contractTableName, (table) => {
    table.dropColumn('debankAddress');
    table.dropColumn('blockchain');
    table.dropColumn('network');
    table.dropColumn('metric');
    table.dropColumn('address');
    table.dropColumn('automate');
    table.dropColumn('deployBlockNumber');
    table.dropColumn('layout');
    table.dropColumn('adapter');
  });
};
