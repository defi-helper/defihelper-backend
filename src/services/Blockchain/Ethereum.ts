import { Container, singleton } from '@services/Container';
import { isKey } from '@services/types';
import axios from 'axios';
import { ethers } from 'ethers';
import masterChefV1ABI from './abi/ethereum/masterChefV1ABI.json';
import erc20ABI from './abi/ethereum/erc20.json';
import uniswapV2PairABI from './abi/ethereum/uniswapPair.json';
import pancakeSmartChefInitializable from './abi/ethereum/pancakeSmartChefInitializableABI.json';
import governorBravoABI from './abi/ethereum/governorBravo.json';

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
  ethMainInspector: string;
  ethRopstenNode: string;
  ethRopstenAvgBlockTime: number;
  ethRopstenInspector: string;
  bscMainNode: string;
  bscMainAvgBlockTime: number;
  bscMainInspector: string;
  polygonMainNode: string;
  polygonMainAvgBlockTime: number;
  polygonMainInspector: string;
  localNode: string;
  localAvgBlockTime: number;
  localInspector: string;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    '1': {
      name: 'Ethereum',
      provider: singleton(providerFactory(this.parent.ethMainNode)),
      avgBlockTime: this.parent.ethMainAvgBlockTime,
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      inspector: () => new ethers.Wallet(this.parent.ethMainInspector, this.networks[1].provider()),
    },
    '3': {
      name: 'Ethereum Ropsten',
      provider: singleton(providerFactory(this.parent.ethRopstenNode)),
      avgBlockTime: this.parent.ethRopstenAvgBlockTime,
      txExplorerURL: new URL('https://ropsten.etherscan.io/tx'),
      walletExplorerURL: new URL('https://ropsten.etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api-ropsten.etherscan.io/api'),
      inspector: () =>
        new ethers.Wallet(this.parent.ethRopstenInspector, this.networks[3].provider()),
    },
    '56': {
      name: 'Binance Smart Chain',
      provider: singleton(providerFactory(this.parent.bscMainNode)),
      avgBlockTime: this.parent.bscMainAvgBlockTime,
      txExplorerURL: new URL('https://bscscan.com/tx'),
      walletExplorerURL: new URL('https://bscscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.bscscan.com/api'),
      inspector: () =>
        new ethers.Wallet(this.parent.bscMainInspector, this.networks[56].provider()),
    },
    '137': {
      name: 'Polygon',
      provider: singleton(providerFactory(this.parent.polygonMainNode)),
      avgBlockTime: this.parent.polygonMainAvgBlockTime,
      txExplorerURL: new URL('https://polygonscan.com/tx'),
      walletExplorerURL: new URL('https://polygonscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.polygonscan.com/api'),
      inspector: () =>
        new ethers.Wallet(this.parent.polygonMainInspector, this.networks[137].provider()),
    },
    '31337': {
      name: '',
      provider: singleton(providerFactory(this.parent.localNode)),
      avgBlockTime: this.parent.localAvgBlockTime,
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      inspector: () =>
        new ethers.Wallet(this.parent.localInspector, this.networks[31337].provider()),
    },
  } as const;

  readonly isNetwork = (network: string | number): network is Networks => {
    return isKey(this.networks, network.toString());
  };

  readonly byNetwork = (network: string | number) => {
    if (!this.isNetwork(network)) throw new Error('Undefined network');

    return this.networks[network];
  };

  readonly contract = (
    address: string,
    abi: ethers.ContractInterface,
    signerOrProvider?: ethers.Signer | ethers.providers.Provider,
  ) => {
    return new ethers.Contract(address, abi, signerOrProvider);
  };

  readonly abi = {
    erc20ABI,
    uniswapV2PairABI,
    masterChefV1ABI,
    pancakeSmartChefInitializable,
    governorBravoABI,
  };
}
