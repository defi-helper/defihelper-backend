import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { MetadataType } from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const contractService = container.model.contractService();
  const metadataService = container.model.metadataService();

  const contract = await contractService.contractTable().where({ id }).first();
  if (!contract || contract.blockchain !== 'ethereum') {
    throw new Error(`Contract "${id}" not found or incompatible`);
  }

  try {
    const network = container.blockchain[contract.blockchain].byNetwork(contract.network);
    const abi = await network.getContractAbi(contract.address);

    await metadataService.createOrUpdate(contract, MetadataType.EthereumContractAbi, abi);
  } catch (e) {
    if (e.message === 'NOT_VERIFIED') {
      await metadataService.createOrUpdate(contract, MetadataType.EthereumContractAbi, null);
      return process.done();
    }

    return process.info(e.message).later(dayjs().add(1, 'minute').toDate());
  }

  return process.done();
};
