import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const metadata = await container.model.metadataTable();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .whereIn(
      `${contractTableName}.id`,
      metadata.map((m) => m.contract),
    );

  await Promise.all(
    metadata.map((meta) => {
      const contract = contracts.find((v) => {
        return v.id === meta.contract;
      });

      if (!contract) {
        return null;
      }

      return container.model
        .metadataTable()
        .where({
          contract: contract.id,
        })
        .update({
          blockchain: contract.blockchain,
          network: contract.network,
          address: contract.address,
        })
        .onConflict(['blockchain', 'network', 'address'])
        .ignore();
    }),
  );

  await container.model
    .metadataTable()
    .whereRaw('address is null and network is null and blockchain is null')
    .delete();

  return process.done();
};
