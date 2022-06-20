import { Process } from '@models/Queue/Entity';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export default async (process: Process) => {
  const watcher = container.watcher();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    );
  await contracts.reduce<Promise<any>>(async (prev, contract) => {
    await prev;

    const watcherContract = await watcher.findContract(contract.network, contract.address);
    if (!watcherContract) return null;

    return watcher.updateContract(watcherContract.id, { fid: contract.id });
  }, Promise.resolve(null));

  return process.done();
};
