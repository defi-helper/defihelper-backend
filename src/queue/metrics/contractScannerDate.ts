import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;

  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();
  if (!contract) throw new Error('Contract not found');
  if (contract.blockchain !== 'ethereum') {
    return process.info('No ethereum').done();
  }

  const protocol = await container.model.protocolTable().where('id', contract.protocol).first();
  if (!protocol) throw new Error('Protocol not found');
  if (protocol.adapter === 'debankByApiReadonly') {
    return process.info('Do not need to add in scanner').done();
  }

  const scanner = container.scanner();
  const scannerContract = await scanner.findContract(contract.network, contract.address);
  if (!scannerContract) {
    await container.model
      .queueService()
      .push('registerContractInScanner', { contract: contract.id, events: [] });

    return process
      .later(dayjs().add(10, 'minute').toDate())
      .info('postponed due to contract registration');
  }

  const { uniqueWalletsCount } = await scanner.getContractStatistics(scannerContract.id);
  await container.model.metricService().createContract(
    contract,
    {
      uniqueWalletsCount: uniqueWalletsCount.toString(),
    },
    new Date(),
  );

  return process.done();
};
