import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import {
  contractBlockchainTableName,
  contractTableName,
  MetadataType,
} from '@models/Protocol/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const contract = await container.model.contractBlockchainTable().where('id', id).first();

  if (!contract) {
    throw new Error(`Could not find contract with id ${id}`);
  }

  let routerAddress: string;
  switch (contract.network) {
    case '1':
      routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      break;

    case '137':
      routerAddress = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';
      break;

    case '10':
      // todo check me, it should be the same with ethereum, but im not sure
      routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
      break;

    case '25':
      routerAddress = '0xcd7d16fB918511BF7269eC4f48d61D79Fb26f918';
      break;

    case '56':
      routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
      break;

    case '56':
      routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
      break;

    default:
      throw new Error(`Could not find contract with id ${id}`);
  }

  const blockchainContainer = container.blockchain.ethereum;
  const provider = blockchainContainer.byNetwork(contract.network).provider();
  const governorBravo = blockchainContainer.contract(
    routerAddress,
    blockchainContainer.abi.uniswapRouterABI,
    provider,
  );

  return process.done();
};
