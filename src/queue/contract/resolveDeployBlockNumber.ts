import container from '@container';
import { Contract } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import { parse } from 'node-html-parser';
import faker from 'faker';

const axiosFakeHeaders = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
  'TE': 'trailers',
};

const oneYearInSeconds = 60 * 60 * 24 * 365;

const getEthereumContractCreationBlock = async ({
  network,
  address,
}: Contract): Promise<number> => {
  const { walletExplorerURL } = container.blockchain.ethereum.byNetwork(network);
  try {
    const res = await axios.get(`${walletExplorerURL}/${address}`, {
      headers: {
        ...axiosFakeHeaders,
        'User-Agent': faker.internet.userAgent(),
      },
    });

    const root = parse(res.data);
    const contractCreatorWrapper = root.querySelector('#ContentPlaceHolder1_trContract');

    const transactionNode = contractCreatorWrapper.querySelectorAll('a').find((e) => {
      const href = e.getAttribute('href');
      return href && href.includes('tx/');
    });

    if (!transactionNode) {
      throw new Error('Not contract creator node');
    }

    const provider = await container.blockchain.ethereum.byNetwork(network).provider();
    const txReceipt = await provider.getTransactionReceipt(transactionNode.text);

    return txReceipt.blockNumber;
  } catch {
    const provider = await container.blockchain.ethereum.byNetwork(network).provider();
    const latestBlock = await provider.getBlockNumber();
    const { avgBlockTime } = container.blockchain.ethereum.byNetwork(network);
    const fallbackBlock = Math.max(0, Math.round(latestBlock - oneYearInSeconds / avgBlockTime));

    return fallbackBlock;
  }
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
