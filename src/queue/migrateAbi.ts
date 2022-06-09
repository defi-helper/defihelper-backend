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
    metadata.map(async (meta) => {
      const contract = contracts.find((v) => {
        return v.id === meta.contract;
      });

      if (!contract) {
        return null;
      }

      try {
        return await container.model
          .metadataTable()
          .where({
            blockchain: contract.blockchain,
            network: contract.network,
            address: contract.address,
          })
          .update({
            blockchain: contract.blockchain,
            network: contract.network,
            address: contract.address,
          });
      } catch {
        console.info('duplicate');
      }

      return null;
    }),
  );

  await container.model
    .metadataTable()
    .whereRaw('address is null and network is null and blockchain is null')
    .delete();

  return process.done();
};
