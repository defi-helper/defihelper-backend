import container from '@container';
import { Process } from '@models/Queue/Entity';

// todo replace it to import from networks
const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        name: '',
        type: 'uint8',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

export interface Params {
  token: string;
}

export default async (process: Process) => {
  const { token: tokenId } = process.task.params as Params;

  const token = await container.model.tokenTable().where('id', tokenId).first();
  if (!token) throw new Error('Token not found');
  if (token.blockchain !== 'ethereum') throw new Error('Invalid blockchain');

  const { provider: providerFactory } = container.blockchain.ethereum.byNetwork(token.network);
  if (providerFactory === null) throw new Error('Blockchain provider not found');

  const contract = container.blockchain.ethereum.contract(
    token.address,
    erc20Abi,
    providerFactory(),
  );
  const [name, symbol, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
  ]);

  await container.model.tokenService().update({
    ...token,
    name,
    symbol,
    decimals,
  });

  return process.done();
};
