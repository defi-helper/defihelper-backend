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
  const value = new BigNumber(params.value).multipliedBy(new BigNumber(10).pow(18));

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
