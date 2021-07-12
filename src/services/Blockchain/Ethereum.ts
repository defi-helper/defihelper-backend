import { Container, singleton } from '@services/Container';
import { isKey } from '@services/types';
import axios from 'axios';
import { ethers } from 'ethers';

export interface EtherscanContractAbiResponse {
  status: string;
  message: string;
  result: string;
}

function useEtherscanContractAbi(host: string) {
  return async (address: string) => {
    const res = await axios.get<EtherscanContractAbiResponse>(
      `${host}?module=contract&action=getabi&address=${address}`,
    );
    const { status, result } = res.data;
    if (status === '0') {
      if (result === 'Max rate limit reached, please use API Key for higher rate limit') {
        throw new Error('RATE_LIMIT');
      }
      if (result === 'Contract source code not verified') {
        throw new Error('NOT_VERIFIED');
      }
    }
    if (status !== '1') {
      throw new Error(`Invalid status "${status}" with message "${result}"`);
    }

    return JSON.parse(res.data.result);
  };
}

function providerFactory(host: string) {
  return () => new ethers.providers.JsonRpcProvider(host);
}

export interface Config {
  ethMainNode: string;
  ethMainAvgBlockTime: number;
  bscMainNode: string;
  bscMainAvgBlockTime: number;
}

export class BlockchainContainer extends Container<Config> {
  readonly byNetwork = (network: string | number) => {
    const normalizeNetwork = network.toString();
    const provider = isKey(this.provider, normalizeNetwork)
      ? this.provider[normalizeNetwork]
      : null;
    const avgBlockTime = isKey(this.avgBlockTime, normalizeNetwork)
      ? this.avgBlockTime[normalizeNetwork]
      : null;

    return {
      provider,
      avgBlockTime,
    };
  };

  readonly provider = {
    '1': singleton(providerFactory(this.parent.ethMainNode)),
    '56': singleton(providerFactory(this.parent.bscMainNode)),
  };

  readonly avgBlockTime = {
    '1': this.parent.ethMainAvgBlockTime,
    '56': this.parent.bscMainAvgBlockTime,
  };

  readonly etherscan = singleton(() => ({
    getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
  }));

  readonly bscscan = singleton(() => ({
    getContractAbi: useEtherscanContractAbi('https://api.bscscan.com/api'),
  }));

  readonly scanByNetwork = (network: number) => {
    switch (network) {
      case 1:
        return this.etherscan();
      case 56:
        return this.bscscan();
      default:
        throw new Error(`Undefined network ${network}`);
    }
  };

  readonly contract = (
    address: string,
    abi: ethers.ContractInterface,
    signerOrProvider?: ethers.Signer | ethers.providers.Provider,
  ) => {
    return new ethers.Contract(address, abi, signerOrProvider);
  };
}
