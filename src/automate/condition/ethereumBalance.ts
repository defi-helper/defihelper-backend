import container from '@container';
import BigNumber from 'bignumber.js';

interface Params {
  network: string;
  wallet: string;
  op: '>' | '>=' | '<' | '<=' | '!=' | '==';
  value: string;
}

export default async (params: Params) => {
  const network = container.blockchain.ethereum.byNetwork(params.network);
  const provider = network.provider();
  const balance = new BigNumber((await provider.getBalance(params.wallet)).toString());

  switch (params.op) {
    case '>':
      return balance.gt(params.value);
    case '>=':
      return balance.gte(params.value);
    case '<':
      return balance.lt(params.value);
    case '<=':
      return balance.lte(params.value);
    case '==':
      return balance.eq(params.value);
    case '!=':
      return !balance.eq(params.value);
    default:
      return false;
  }
};
