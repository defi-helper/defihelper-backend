import { Container, singleton } from '@services/Container';
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

const ScannerURL: Record<string, URL> = {
  '1': new URL('https://etherscan.io'),
  '56': new URL('https://bscscan.com'),
};

export class BlockchainContainer extends Container<Config> {
  readonly byNetwork = (network: string | number) => {
    const normalizeNetwork = network.toString();
    const provider = this.provider[normalizeNetwork] || null;
    const avgBlockTime = this.avgBlockTime[normalizeNetwork] || null;

    return {
      provider,
      avgBlockTime,
    };
  };

  readonly provider: Record<string, () => ethers.providers.JsonRpcProvider> = {
    '1': singleton(providerFactory(this.parent.ethMainNode)),
    '56': singleton(providerFactory(this.parent.bscMainNode)),
  };

  readonly avgBlockTime: Record<string, number> = {
    '1': this.parent.ethMainAvgBlockTime,
    '56': this.parent.bscMainAvgBlockTime,
  };

  readonly etherscan = singleton(() => ({
    getContractAbi: useEtherscanContractAbi(`https://api.${ScannerURL['1'].host}/api`),
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

  readonly explorerUrlByNetwork = (network: string) => {
    const url = ScannerURL[network];
    if (!url) {
      throw new Error(`Undefined network ${network}`);
    }

    return url.href;
  };

  readonly contract = (
    address: string,
    abi: ethers.ContractInterface,
    signerOrProvider?: ethers.Signer | ethers.providers.Provider,
  ) => {
    return new ethers.Contract(address, abi, signerOrProvider);
  };
}
