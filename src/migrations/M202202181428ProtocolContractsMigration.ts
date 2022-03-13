import { SchemaBuilder } from 'knex';
import container from '@container';
import {
  contractBlockchainTableName,
  contractDebankTableName,
  contractTableName,
} from '@models/Protocol/Entity';

export default async (schema: SchemaBuilder) => {
  const database = container.database();

  await database.raw(`
    insert into ${contractBlockchainTableName} (id, blockchain, network, address, metric, automate, "deployBlockNumber", adapter)
      select
          rootContract.id, rootContract.blockchain, rootContract.network, rootContract.address, rootContract.metric, rootContract.automate, rootContract."deployBlockNumber", rootContract.adapter
      from protocol_contract AS rootContract where adapter != 'debankApiReadonly'
    on conflict do nothing
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
    table.dropColumn('adapter');
  });
};
