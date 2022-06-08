import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const metadata = await container.model.metadataTable();
  const [contracts, contractsBlockchain] = await Promise.all([
    container.model.contractTable().whereIn(
      'id',
      metadata.map((m) => m.contract),
    ),
    container.model.contractBlockchainTable().whereIn(
      'id',
      metadata.map((m) => m.contract),
    ),
  ]);

  await Promise.all(
    metadata.map(async (meta) => {
      const contract = contracts.find((v) => {
        return v.id === meta.contract;
      });
      const blockchainContract = contractsBlockchain.find((v) => v.id === meta.contract);
      if (!blockchainContract || !contract) {
        return null;
      }

      try {
        return await container.model
          .metadataService()
          .createOrUpdate(
            contract,
            meta.type,
            meta.value,
            blockchainContract.blockchain,
            blockchainContract.network,
            blockchainContract.address,
          );
      } catch {
        console.warn('duplicate');
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
