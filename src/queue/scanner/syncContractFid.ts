import { Process } from '@models/Queue/Entity';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export default async (process: Process) => {
  const scanner = container.scanner();
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    );
  await contracts.reduce<Promise<any>>(async (prev, contract) => {
    await prev;

    const scannerContract = await scanner.findContract(contract.network, contract.address);
    if (!scannerContract) return null;

    return scanner.updateContract(scannerContract.id, { fid: contract.id });
  }, Promise.resolve(null));

  return process.done();
};
