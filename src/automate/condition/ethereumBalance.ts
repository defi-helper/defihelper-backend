import container from '@container';
import BN from 'bignumber.js';
import { ethers } from 'ethers';

export interface Params {
  network: string;
  wallet: string;
  op: '>' | '>=' | '<' | '<=' | '!=' | '==';
  value: string;
}

export function paramsVerify(params: any): params is Params {
  const { network, wallet, op, value } = params;
  if (typeof network !== 'string' || !container.blockchain.ethereum.isNetwork(network)) {
    throw new Error('Invalid network');
  }
  if (typeof wallet !== 'string' || !ethers.utils.isAddress(wallet)) {
    throw new Error('Invalid wallet');
  }
  if (typeof op !== 'string' || !['>', '>=', '<', '<=', '!=', '=='].includes(op)) {
    throw new Error('Invalid operator');
  }
  if (typeof value !== 'string' || new BN(value).isNaN()) {
    throw new Error('Invalid value');
  }

  return true;
}

export default async (params: Params) => {
  const network = container.blockchain.ethereum.byNetwork(params.network);
  const provider = network.provider();
  const balance = new BN(await provider.getBalance(params.wallet).then((v) => v.toString()));
  const value = new BN(params.value).multipliedBy(new BN(10).pow(18));

  switch (params.op) {
    case '>':
      return balance.gt(value);
    case '>=':
      return balance.gte(value);
    case '<':
      return balance.lt(value);
    case '<=':
      return balance.lte(value);
    case '==':
      return balance.eq(value);
    case '!=':
      return !balance.eq(value);
    default:
      return false;
  }
};
