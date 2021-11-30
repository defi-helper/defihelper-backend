import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { Blockchain } from '@models/types';
import { MetadataType } from '@models/Protocol/Entity';

export interface Params {
  id: string;
  blockchain: Blockchain;
}

export default async (process: Process) => {
  const { id, blockchain } = process.task.params as Params;

  if (blockchain === 'waves') {
    throw new Error('Unsupported blockchain');
  }

  const contractService = container.model.contractService();
  const metadataService = container.model.metadataService();

  const contract = await contractService.contractTable().where({ id }).first();
  if (!contract) {
    throw new Error(`Contract "${id}" not found`);
  }

  try {
    const network = container.blockchain[blockchain].byNetwork(contract.network);
    const abi = await network.getContractAbi(contract.address);

    await metadataService.createOrUpdate(contract, MetadataType.EthereumContractAbi, abi);
  } catch (e) {
    return process.later(dayjs().add(10, 'seconds').toDate());
  }

  return process.done();
};
