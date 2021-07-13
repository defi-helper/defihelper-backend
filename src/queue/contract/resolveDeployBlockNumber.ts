import container from '@container';
import { Contract } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { parse } from 'node-html-parser';

const getEthereumContractCreationBlock = async ({
  network,
  address,
}: Contract): Promise<number> => {
  const { walletExplorerURL } = container.blockchain.ethereum.byNetwork(network);
  const res = await axios.get(`${walletExplorerURL}/${address}`);
  const root = parse(res.data);
  const contractCreatorNode = root
    .querySelectorAll('div')
    .find((div) => div.text === '\nContractCreator:');
  if (!contractCreatorNode) {
    throw new Error('Not contract creator node');
  }

  const txHrefNode = contractCreatorNode.parentNode.querySelectorAll('a').find((a) => {
    const href = a.getAttribute('href');
    return href && href.indexOf('/tx') > -1;
  });
  if (!txHrefNode) {
    throw new Error('Not creator tx');
  }

  const txHref = txHrefNode.getAttribute('href');
  if (!txHref) {
    throw new Error('Not creator href');
  }

  const txHash = txHref.replace('/tx/', '');
  const provider = await container.blockchain.ethereum.byNetwork(network).provider();
  const txReceipt = await provider.getTransactionReceipt(txHash);

  return txReceipt.blockNumber;
};

export interface Params {
  contract: string;
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as Params;
  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) throw new Error('Contract not found');

  if (contract.blockchain !== 'ethereum') throw new Error('Invalid blockchain');
  if (contract.deployBlockNumber !== null) throw new Error('Deploy block already resolved');

  const deployBlockNumber = await getEthereumContractCreationBlock(contract);
  await container.model.contractService().update({
    ...contract,
    deployBlockNumber: deployBlockNumber.toString(),
  });

  return process.done();
};
