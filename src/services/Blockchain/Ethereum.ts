import { Container, Factory, singleton } from '@services/Container';
import dfhContracts from '@defihelper/networks/contracts.json';
import { isKey } from '@services/types';
import axios from 'axios';
import { ethers } from 'ethers';
import { abi as erc20ABI } from '@defihelper/networks/abi/ERC20.json';
import { abi as erc1167ABI } from '@defihelper/networks/abi/ERC1167.json';
import { abi as governorBravoABI } from '@defihelper/networks/abi/GovernorBravo.json';
import { abi as governanceTokenABI } from '@defihelper/networks/abi/GovernanceToken.json';
import { abi as treasuryABI } from '@defihelper/networks/abi/Treasury.json';
import automateABI from './abi/ethereum/automate.json';
import masterChefV1ABI from './abi/ethereum/masterChefV1ABI.json';
import uniswapV2PairABI from './abi/ethereum/uniswapPair.json';
import pancakeSmartChefInitializable from './abi/ethereum/pancakeSmartChefInitializableABI.json';
import synthetixStaking from './abi/ethereum/synthetixStakingABI.json';

function providerFactory(host: string) {
  return () => new ethers.providers.JsonRpcProvider(host);
}

function providerRandomizerFactory(factories: Array<Factory<ethers.providers.JsonRpcProvider>>) {
  return () => {
    if (factories.length === 0) throw new Error('Providers not found');

    return factories[Math.floor(Math.random() * factories.length)]();
  };
}

function signersFactory(
  consumersPrivateKeys: string[],
  provider: ethers.providers.JsonRpcProvider,
) {
  return consumersPrivateKeys.map((privateKey) => new ethers.Wallet(privateKey, provider));
}

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

function coingeckoPriceFeedUSD(coinId: string) {
  return async () => {
    const {
      data: {
        [coinId]: { usd },
      },
    } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return usd;
  };
}

export interface NetworkConfig {
  node: string[];
  historicalNode: string[];
  avgBlockTime: number;
  inspectors: string[];
  consumers: string[];
}

function networkFactory(
  id: string,
  name: string,
  txExplorerURL: URL,
  walletExplorerURL: URL,
  getContractAbi: (address: string) => Promise<ethers.ContractInterface>,
  priceFeedUSD: () => Promise<string>,
  { node, historicalNode, avgBlockTime, inspectors, consumers }: NetworkConfig,
) {
  const provider = providerRandomizerFactory(node.map((host) => singleton(providerFactory(host))));

  return {
    name,
    provider,
    providerHistorical: providerRandomizerFactory(
      historicalNode.map((host) => singleton(providerFactory(host))),
    ),
    avgBlockTime,
    txExplorerURL,
    walletExplorerURL,
    getContractAbi,
    priceFeedUSD,
    inspector: () => (inspectors.length > 0 ? new ethers.Wallet(inspectors[0], provider()) : null),
    consumers: () => signersFactory(consumers, provider()),
    dfhContracts: () => (isKey(dfhContracts, id) ? dfhContracts[id] : null),
  };
}

export interface Config {
  eth: NetworkConfig;
  ethRopsten: NetworkConfig;
  bsc: NetworkConfig;
  polygon: NetworkConfig;
  avalanch: NetworkConfig;
  local: NetworkConfig;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    '1': networkFactory(
      '1',
      'Ethereum',
      new URL('https://etherscan.io/tx'),
      new URL('https://etherscan.io/address'),
      useEtherscanContractAbi('https://api.etherscan.io/api'),
      coingeckoPriceFeedUSD('ethereum'),
      this.parent.eth,
    ),
    '3': networkFactory(
      '3',
      'Ethereum Ropsten',
      new URL('https://ropsten.etherscan.io/tx'),
      new URL('https://ropsten.etherscan.io/address'),
      useEtherscanContractAbi('https://api-ropsten.etherscan.io/api'),
      coingeckoPriceFeedUSD('ethereum'),
      this.parent.ethRopsten,
    ),
    '56': networkFactory(
      '56',
      'Binance Smart Chain',
      new URL('https://bscscan.com/tx'),
      new URL('https://bscscan.com/address'),
      useEtherscanContractAbi('https://api.bscscan.com/api'),
      coingeckoPriceFeedUSD('binancecoin'),
      this.parent.bsc,
    ),
    '137': networkFactory(
      '137',
      'Polygon',
      new URL('https://polygonscan.com/tx'),
      new URL('https://polygonscan.com/address'),
      useEtherscanContractAbi('https://api.polygonscan.com/api'),
      coingeckoPriceFeedUSD('matic-network'),
      this.parent.polygon,
    ),
    '43114': networkFactory(
      '43114',
      'Avalanche',
      new URL('https://snowtrace.io/tx'),
      new URL('https://snowtrace.io/address'),
      async (address: string) => {
        const res = await axios.get(
          `https://repo.sourcify.dev/contracts/full_match/43114/${address}/metadata.json`,
        );
        return res.data.output.abi;
      },
      coingeckoPriceFeedUSD('avalanche-2'),
      this.parent.avalanch,
    ),
    '31337': networkFactory(
      '31337',
      'Localhost',
      new URL('https://etherscan.io/tx'),
      new URL('https://etherscan.io/address'),
      useEtherscanContractAbi('https://api.etherscan.io/api'),
      coingeckoPriceFeedUSD('ethereum'),
      this.parent.local,
    ),
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
    erc1167ABI,
    uniswapV2PairABI,
    masterChefV1ABI,
    pancakeSmartChefInitializable,
    synthetixStaking,
    governorBravoABI,
    governanceTokenABI,
    treasuryABI,
    automateABI,
  };
}
