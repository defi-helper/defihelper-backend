import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { Blockchain } from '@models/types';
import axios from 'axios';
import { parse } from 'node-html-parser';

export interface ContractRegisterParams {
  contract: string;
}

const getEthereumContractCreationBlock = async (
  network: string,
  address: string,
): Promise<number | undefined> => {
  const explorerUrl = container.blockchain.ethereum.explorerUrlByNetwork(network);
  const res = await axios.get(`${explorerUrl}/address/${address}`);
  const root = parse(res.data);
  const contractCreatorNode = root
    .querySelectorAll('div')
    .find((div) => div.text === '\nContractCreator:');
  if (!contractCreatorNode) {
    return undefined;
  }

  const txHrefNode = contractCreatorNode.parentNode.querySelectorAll('a').find((a) => {
    const href = a.getAttribute('href');
    return href && href.indexOf('/tx') > -1;
  });

  if (!txHrefNode) {
    return undefined;
  }

  const txHref = txHrefNode.getAttribute('href');

  if (!txHref) {
    return undefined;
  }

  const txHash = txHref.replace('/tx/', '');

  try {
    const provider = await container.blockchain.ethereum.byNetwork(network).provider;
    if (!provider) {
      return undefined;
    }
    const txReceipt = await provider().getTransactionReceipt(txHash);
    return txReceipt.blockNumber;
  } catch {
    return undefined;
  }
};

export const getContractCreationBlock = async (
  blockchain: Blockchain,
  network: string,
  address: string,
): Promise<number | undefined> => {
  if (blockchain === 'ethereum') {
    return getEthereumContractCreationBlock(network, address);
  }

  return undefined;
};

export default async (process: Process) => {
  const registerParams = process.task.params as ContractRegisterParams;

  const contract = await container.model
    .contractTable()
    .where('id', registerParams.contract)
    .first();

  if (!contract) {
    throw new Error('Contract is not found');
  }

  const startHeight = contract.deployBlockNumber
    ? parseInt(contract.deployBlockNumber, 10)
    : await getContractCreationBlock(contract.blockchain, contract.network, contract.address);

  const contractFromScanner = await container
    .scanner()
    .findContract(contract.network, contract.address);
  if (!contractFromScanner || !contractFromScanner.abi) {
    await container
      .scanner()
      .registerContract(contract.network, contract.address, contract.name, startHeight);
    return process.later(dayjs().add(1, 'minutes').toDate());
  }

  const events: string[] = contractFromScanner.abi
    .filter(({ type }: any) => type === 'event')
    .map(({ name }: any) => name);

  await Promise.all(
    events.map((event) =>
      container.scanner().registerListener(contractFromScanner.id, event, startHeight),
    ),
  );

  return process.done();
};
