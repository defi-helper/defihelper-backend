import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const queue = container.model.queueService();
  const scanner = container.scanner();
  const contractService = container.model.contractService();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where('blockchain', 'ethereum')
    .whereNull('watcherId');

  await contracts.reduce<Promise<any>>(async (prev, contract) => {
    await prev;
    const watcherContract = await scanner.findContract(contract.network, contract.address);
    if (!watcherContract) {
      return queue.push('registerContractInScanner', { contract: contract.id });
    }
    return contractService.updateBlockchain({
      ...contract,
      watcherId: watcherContract.id,
    });
  }, Promise.resolve(null));

  return process.done();
};
