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
import container from '@container';
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

function cacheGet(tokenKey: string): Promise<string | null> {
  return new Promise((resolve) =>
    container.cache().get(`defihelper:token:${tokenKey}`, (err, result) => {
      if (err || !result) return resolve(null);
      return resolve(result);
    }),
  );
}

function cacheSet(tokenKey: string, value: string): void {
  container.cache().setex(`defihelper:token:${tokenKey}`, 3600, value);
}

function signersFactory(
  consumersPrivateKeys: string[],
  provider: ethers.providers.JsonRpcProvider,
) {
  return consumersPrivateKeys.map((privateKey) => new ethers.Wallet(privateKey, provider));
}

interface AvgGasPriceResolver {
  (): Promise<string>;
}

interface NativePriceFeedUSD {
  (): Promise<string>;
}

interface TokenPriceFeedUSD {
  (address: string): Promise<string>;
}

interface ContractABIResolver {
  (address: string): Promise<ethers.ContractInterface>;
}

function networkFactory({
  id,
  name,
  txExplorerURL,
  walletExplorerURL,
  getContractAbi,
  getAvgGasPrice,
  nativeTokenPrice,
  nativeTokenDetails,
  tokenPriceResolver,
  network: { node, historicalNode, avgBlockTime, inspectors, consumers },
}: {
  id: string;
  name: string;
  txExplorerURL: URL;
  walletExplorerURL: URL;
  getContractAbi: ContractABIResolver;
  getAvgGasPrice: AvgGasPriceResolver;
  nativeTokenPrice: NativePriceFeedUSD;
  nativeTokenDetails: NativeTokenDetails;
  tokenPriceResolver: { usd: TokenPriceFeedUSD };
  network: NetworkConfig;
}) {
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
    getAvgGasPrice,
    nativeTokenPrice,
    tokenPriceResolver,
    nativeTokenDetails,
    inspector: () => (inspectors.length > 0 ? new ethers.Wallet(inspectors[0], provider()) : null),
    consumers: () => signersFactory(consumers, provider()),
    dfhContracts: () => (isKey(dfhContracts, id) ? dfhContracts[id] : null),
  };
}

function useEtherscanContractAbi(host: string): ContractABIResolver {
  return async (address: string) => {
    const res = await axios.get<{
      status: string;
      message: string;
      result: string;
    }>(`${host}?module=contract&action=getabi&address=${address}`);
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

function coingeckoPriceFeedUSD(coinId: string): NativePriceFeedUSD {
  return async () => {
    const key = `ethereum:native:${coinId}:price`;
    const chainNativeUSD = await cacheGet(key);
    if (!chainNativeUSD) {
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
      cacheSet(key, usd);
      return usd;
    }

    return chainNativeUSD;
  };
}

function moralisPriceFeed(network: string): { usd: TokenPriceFeedUSD } {
  return {
    usd: async (address: string) => {
      const key = `ethereum:${network}:${address}:price`;
      const moralis = await container.moralis().getWeb3API();

      let chain: 'eth' | 'bsc' | 'polygon' | 'avalanche';
      switch (network) {
        case '1':
          chain = 'eth';
          break;
        case '56':
          chain = 'bsc';
          break;
        case '137':
          chain = 'polygon';
          break;
        case '43114':
          chain = 'avalanche';
          break;
        default:
          throw new Error(`unsupported network: ${network}`);
      }

      const cachedPrice = await cacheGet(key);
      if (cachedPrice) {
        return cachedPrice;
      }

      const result = await moralis.token.getTokenPrice({
        chain,
        address,
      });

      cacheSet(key, result.usdPrice.toString(10));
      return result.usdPrice.toString(10);
    },
  };
}

function debankPriceFeed(network: string): { usd: TokenPriceFeedUSD } {
  return {
    usd: async (address: string) => {
      const key = `ethereum:${network}:${address}:price`;

      let chain: 'movr';
      switch (network) {
        case '1285':
          chain = 'movr';
          break;
        default:
          throw new Error(`unsupported network: ${network}`);
      }

      const cachedPrice = await cacheGet(key);
      if (cachedPrice) {
        return cachedPrice;
      }

      const debankApiResponse = (
        await axios.get(`https://openapi.debank.com/v1/token?chain_id=${chain}&id=${address}`)
      ).data as { price: number };

      cacheSet(key, debankApiResponse.price.toString(10));
      return debankApiResponse.price.toString(10);
    },
  };
}

function avgGasPriceFeedManual(value: string): AvgGasPriceResolver {
  return async () => value;
}

export interface NetworkConfig {
  node: string[];
  historicalNode: string[];
  avgBlockTime: number;
  inspectors: string[];
  consumers: string[];
}

export interface NativeTokenDetails {
  decimals: number;
  symbol: string;
  name: string;
}

export interface Config {
  eth: NetworkConfig;
  ethRopsten: NetworkConfig;
  bsc: NetworkConfig;
  polygon: NetworkConfig;
  moonriver: NetworkConfig;
  avalanche: NetworkConfig;
  avalancheTestnet: NetworkConfig;
  local: NetworkConfig;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    '1': networkFactory({
      id: '1',
      name: 'Ethereum',
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('130000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: moralisPriceFeed('1'),
      network: this.parent.eth,
    }),
    '3': networkFactory({
      id: '3',
      name: 'Ethereum Ropsten',
      txExplorerURL: new URL('https://ropsten.etherscan.io/tx'),
      walletExplorerURL: new URL('https://ropsten.etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api-ropsten.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('2000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: moralisPriceFeed('1'),
      network: this.parent.ethRopsten,
    }),
    '56': networkFactory({
      id: '56',
      name: 'Binance Smart Chain',
      txExplorerURL: new URL('https://bscscan.com/tx'),
      walletExplorerURL: new URL('https://bscscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.bscscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('7000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('binancecoin'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'BSC',
        name: 'Binance Smart Chain',
      },
      tokenPriceResolver: moralisPriceFeed('56'),
      network: this.parent.bsc,
    }),
    '137': networkFactory({
      id: '137',
      name: 'Polygon',
      txExplorerURL: new URL('https://polygonscan.com/tx'),
      walletExplorerURL: new URL('https://polygonscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.polygonscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('30000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('matic-network'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'MATIC',
        name: 'Polygon',
      },
      tokenPriceResolver: moralisPriceFeed('137'),
      network: this.parent.polygon,
    }),
    '1285': networkFactory({
      id: '1285',
      name: 'Moonriver',
      txExplorerURL: new URL('https://moonriver.moonscan.io/tx'),
      walletExplorerURL: new URL('https://moonriver.moonscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api-moonriver.moonscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('3000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('moonriver'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'MOVR',
        name: 'Moonriver',
      },
      tokenPriceResolver: debankPriceFeed('1285'),
      network: this.parent.moonriver,
    }),
    '43113': networkFactory({
      id: '43113',
      name: 'Avalanche Testnet',
      txExplorerURL: new URL('https://testnet.snowtrace.io/tx'),
      walletExplorerURL: new URL('https://testnet.snowtrace.io/address'),
      getContractAbi: async (address: string) => {
        const res = await axios.get(
          `https://repo.sourcify.dev/contracts/full_match/43113/${address}/metadata.json`,
        );
        return res.data.output.abi;
      },
      getAvgGasPrice: avgGasPriceFeedManual('25000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('avalanche-2'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'AVAX',
        name: 'Avalanche',
      },
      tokenPriceResolver: moralisPriceFeed('43113'),
      network: this.parent.avalancheTestnet,
    }),
    '43114': networkFactory({
      id: '43114',
      name: 'Avalanche',
      txExplorerURL: new URL('https://snowtrace.io/tx'),
      walletExplorerURL: new URL('https://snowtrace.io/address'),
      getContractAbi: async (address: string) => {
        const res = await axios.get(
          `https://repo.sourcify.dev/contracts/full_match/43114/${address}/metadata.json`,
        );
        return res.data.output.abi;
      },
      getAvgGasPrice: avgGasPriceFeedManual('25000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('avalanche-2'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'AVAX',
        name: 'Avalanche',
      },
      tokenPriceResolver: moralisPriceFeed('43113'),
      network: this.parent.avalanche,
    }),
    '31337': networkFactory({
      id: '31337',
      name: 'Localhost',
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('1000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: moralisPriceFeed('1'),
      network: this.parent.local,
    }),
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
