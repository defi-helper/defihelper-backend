import { Container, Factory, singleton } from '@services/Container';
import { URL } from 'url';
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

function providerFactory(url: URL) {
  return () =>
    new ethers.providers.JsonRpcProvider({
      url: `${url.protocol}//${url.hostname}${url.pathname}`,
      user: url.username ? url.username : undefined,
      password: url.password ? url.password : undefined,
    });
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
  testnet,
  name,
  icon,
  explorerURL,
  txExplorerURL,
  walletExplorerURL,
  etherscanApiURL,
  getContractAbi,
  getAvgGasPrice,
  nativeTokenPrice,
  nativeTokenDetails,
  tokenPriceResolver,
  network: { node, historicalNode, avgBlockTime, inspectors, consumers },
}: {
  id: string;
  name: string;
  testnet: boolean;
  icon: string;
  explorerURL: URL;
  txExplorerURL: URL;
  walletExplorerURL: URL;
  etherscanApiURL: URL | null;
  getContractAbi: ContractABIResolver;
  getAvgGasPrice: AvgGasPriceResolver;
  nativeTokenPrice: NativePriceFeedUSD;
  nativeTokenDetails: NativeTokenDetails;
  tokenPriceResolver: { usd: TokenPriceFeedUSD };
  network: NetworkConfig;
}) {
  const provider = providerRandomizerFactory(
    node.map((host) => singleton(providerFactory(new URL(host)))),
  );
  const providerHistorical = providerRandomizerFactory(
    historicalNode.map((host) => singleton(providerFactory(new URL(host)))),
  );

  return {
    id,
    name,
    testnet,
    icon,
    provider,
    hasProvider: node.length > 0,
    providerHistorical,
    hasProviderHistorical: historicalNode.length > 0,
    avgBlockTime,
    explorerURL,
    txExplorerURL,
    walletExplorerURL,
    getContractAbi,
    getAvgGasPrice,
    etherscanApiURL,
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

/**
 * @param {string} coinApiId - Api coin identifier(not from url of the coingecko website).
 */
function coingeckoPriceFeedUSD(coinApiId: string): NativePriceFeedUSD {
  return async () => {
    const key = `ethereum:native:${coinApiId}:price`;
    const chainNativeUSD = await cacheGet(key);
    if (!chainNativeUSD) {
      const {
        data: {
          [coinApiId]: { usd },
        },
      } = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinApiId}&vs_currencies=usd`,
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

function debankPriceFeed(network: string): { usd: TokenPriceFeedUSD } {
  return {
    usd: async (address: string) => {
      const key = `ethereum:${network}:${address}:price`;

      const cachedPrice = await cacheGet(key);
      if (cachedPrice) {
        return cachedPrice;
      }

      const { price } = await container.debank().getToken(network, address);
      cacheSet(key, price.toString());

      return price.toString();
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
  aurora: NetworkConfig;
  ethRopsten: NetworkConfig;
  ethRinkeby: NetworkConfig;
  bsc: NetworkConfig;
  polygon: NetworkConfig;
  cronos: NetworkConfig;
  fantom: NetworkConfig;
  arbitrum: NetworkConfig;
  optimistic: NetworkConfig;
  moonriver: NetworkConfig;
  moonbeam: NetworkConfig;
  avalanche: NetworkConfig;
  avalancheTestnet: NetworkConfig;
  harmony: NetworkConfig;
  local: NetworkConfig;
}

export type Networks = keyof BlockchainContainer['networks'];

export class BlockchainContainer extends Container<Config> {
  readonly networks = {
    '1': networkFactory({
      id: '1',
      testnet: false,
      name: 'Ethereum',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://etherscan.io'),
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      etherscanApiURL: new URL('https://api.etherscan.io/api'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('130000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.eth,
    }),
    '3': networkFactory({
      id: '3',
      testnet: true,
      name: 'Ethereum Ropsten',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://ropsten.etherscan.io'),
      txExplorerURL: new URL('https://ropsten.etherscan.io/tx'),
      etherscanApiURL: null,
      walletExplorerURL: new URL('https://ropsten.etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api-ropsten.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('2000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.ethRopsten,
    }),
    '4': networkFactory({
      id: '4',
      testnet: true,
      name: 'Ethereum Rinkeby',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://rinkeby.etherscan.io'),
      txExplorerURL: new URL('https://rinkeby.etherscan.io/tx'),
      etherscanApiURL: null,
      walletExplorerURL: new URL('https://rinkeby.etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api-rinkeby.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('2000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.ethRinkeby,
    }),
    '10': networkFactory({
      id: '10',
      testnet: false,
      name: 'Optimistic',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://optimistic.etherscan.io'),
      txExplorerURL: new URL('https://optimistic.etherscan.io/tx'),
      walletExplorerURL: new URL('https://optimistic.etherscan.io/address'),
      etherscanApiURL: new URL('https://api-optimistic.etherscan.io/api'),
      getContractAbi: useEtherscanContractAbi('https://api-optimistic.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('1000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'OETH',
        name: 'Optimism Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('10'),
      network: this.parent.optimistic,
    }),
    '25': networkFactory({
      id: '25',
      testnet: false,
      name: 'Cronos',
      icon: 'cronos',
      explorerURL: new URL('https://cronoscan.com'),
      txExplorerURL: new URL('https://cronoscan.com/tx'),
      walletExplorerURL: new URL('https://cronoscan.com/address'),
      etherscanApiURL: new URL('https://api.cronoscan.com/api'),
      getContractAbi: useEtherscanContractAbi('https://api.cronoscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('5000000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('crypto-com-chain'),
      nativeTokenDetails: {
        decimals: 8,
        symbol: 'CRO',
        name: 'Cronos',
      },
      tokenPriceResolver: debankPriceFeed('25'),
      network: this.parent.cronos,
    }),
    '56': networkFactory({
      id: '56',
      testnet: false,
      name: 'Binance Smart Chain',
      icon: 'bnbRegular',
      explorerURL: new URL('https://bscscan.com'),
      txExplorerURL: new URL('https://bscscan.com/tx'),
      etherscanApiURL: new URL('https://api.bscscan.com/api'),
      walletExplorerURL: new URL('https://bscscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.bscscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('7000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('binancecoin'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'BNB',
        name: 'BNB',
      },
      tokenPriceResolver: debankPriceFeed('56'),
      network: this.parent.bsc,
    }),
    '137': networkFactory({
      id: '137',
      testnet: false,
      name: 'Polygon',
      icon: 'polygon',
      explorerURL: new URL('https://polygonscan.com'),
      txExplorerURL: new URL('https://polygonscan.com/tx'),
      etherscanApiURL: new URL('https://api.polygonscan.com/api'),
      walletExplorerURL: new URL('https://polygonscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.polygonscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('30000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('matic-network'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'MATIC',
        name: 'Polygon',
      },
      tokenPriceResolver: debankPriceFeed('137'),
      network: this.parent.polygon,
    }),
    '250': networkFactory({
      id: '250',
      testnet: false,
      name: 'Fantom',
      icon: 'fantom',
      explorerURL: new URL('https://ftmscan.com'),
      txExplorerURL: new URL('https://ftmscan.com/tx'),
      etherscanApiURL: new URL('https://api.ftmscan.com/api'),
      walletExplorerURL: new URL('https://ftmscan.com/address'),
      getContractAbi: useEtherscanContractAbi('https://api.ftmscan.com/api'),
      getAvgGasPrice: avgGasPriceFeedManual('300000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('fantom'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'FTM',
        name: 'Fantom',
      },
      tokenPriceResolver: debankPriceFeed('250'),
      network: this.parent.fantom,
    }),
    '1284': networkFactory({
      id: '1284',
      testnet: false,
      name: 'Moonbeam',
      icon: 'moonbeam',
      explorerURL: new URL('https://moonbeam.moonscan.io'),
      txExplorerURL: new URL('https://moonbeam.moonscan.io/tx'),
      walletExplorerURL: new URL('https://moonbeam.moonscan.io/address'),
      etherscanApiURL: new URL('https://api-moonbeam.moonscan.io/api'),
      getContractAbi: useEtherscanContractAbi('https://api-moonbeam.moonscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('2750000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('moonbeam'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'GLMR',
        name: 'Moonbeam',
      },
      tokenPriceResolver: debankPriceFeed('1284'),
      network: this.parent.moonriver,
    }),
    '1285': networkFactory({
      id: '1285',
      testnet: false,
      name: 'Moonriver',
      icon: 'moonriver',
      explorerURL: new URL('https://moonriver.moonscan.io'),
      txExplorerURL: new URL('https://moonriver.moonscan.io/tx'),
      etherscanApiURL: new URL('https://api-moonriver.moonscan.io'),
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
    '31337': networkFactory({
      id: '31337',
      testnet: true,
      name: 'Localhost',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://etherscan.io'),
      txExplorerURL: new URL('https://etherscan.io/tx'),
      walletExplorerURL: new URL('https://etherscan.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.etherscan.io/api'),
      etherscanApiURL: null,
      getAvgGasPrice: avgGasPriceFeedManual('1000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.local,
    }),
    '42161': networkFactory({
      id: '42161',
      testnet: false,
      name: 'Arbitrum',
      icon: 'arbitrum',
      explorerURL: new URL('https://arbiscan.io'),
      txExplorerURL: new URL('https://arbiscan.io/tx'),
      walletExplorerURL: new URL('https://arbiscan.io/address'),
      etherscanApiURL: new URL('https://api.arbiscan.io/api'),
      getContractAbi: useEtherscanContractAbi('https://api.arbiscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('600000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('42161'),
      network: this.parent.arbitrum,
    }),
    '43113': networkFactory({
      id: '43113',
      testnet: true,
      name: 'Avalanche Testnet',
      icon: 'avalanche',
      explorerURL: new URL('https://testnet.snowtrace.io'),
      txExplorerURL: new URL('https://testnet.snowtrace.io/tx'),
      etherscanApiURL: null,
      walletExplorerURL: new URL('https://testnet.snowtrace.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.snowtrace.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('25000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('avalanche-2'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'AVAX',
        name: 'Avalanche',
      },
      tokenPriceResolver: debankPriceFeed('43113'),
      network: this.parent.avalancheTestnet,
    }),
    '43114': networkFactory({
      id: '43114',
      testnet: false,
      name: 'Avalanche',
      icon: 'avalanche',
      explorerURL: new URL('https://snowtrace.io'),
      txExplorerURL: new URL('https://snowtrace.io/tx'),
      etherscanApiURL: new URL('https://api.snowtrace.io/api'),
      walletExplorerURL: new URL('https://snowtrace.io/address'),
      getContractAbi: useEtherscanContractAbi('https://api.snowtrace.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('25000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('avalanche-2'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'AVAX',
        name: 'Avalanche',
      },
      tokenPriceResolver: debankPriceFeed('43114'),
      network: this.parent.avalanche,
    }),
    '1313161554': networkFactory({
      id: '1313161554',
      testnet: false,
      name: 'Aurora',
      icon: 'aurora',
      explorerURL: new URL('https://aurorascan.dev'),
      txExplorerURL: new URL('https://aurorascan.dev/tx'),
      walletExplorerURL: new URL('https://aurorascan.dev/address'),
      etherscanApiURL: new URL('https://api.aurorascan.dev/api'),
      getContractAbi: useEtherscanContractAbi('https://api.aurorascan.dev/api?'),
      getAvgGasPrice: avgGasPriceFeedManual('5500000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('aurora-near'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ETH',
        name: 'Ethereum',
      },
      tokenPriceResolver: debankPriceFeed('1313161554'),
      network: this.parent.aurora,
    }),
    '1666600000': networkFactory({
      id: '1666600000',
      testnet: false,
      name: 'Harmony',
      icon: 'harmony',
      explorerURL: new URL('https://explorer.harmony.one'),
      txExplorerURL: new URL('https://explorer.harmony.one/tx'),
      walletExplorerURL: new URL('https://explorer.harmony.one/address'),
      etherscanApiURL: null,
      getContractAbi: () => {
        throw new Error('Contract ABI resolver not supported for network "1666600000"');
      },
      getAvgGasPrice: avgGasPriceFeedManual('1000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('harmony'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'ONE',
        name: 'Harmony',
      },
      tokenPriceResolver: debankPriceFeed('1666600000'),
      network: this.parent.harmony,
    }),
  } as const;

  readonly isNetwork = (network: string | number): network is Networks => {
    return isKey(this.networks, String(network));
  };

  readonly byNetwork = (network: string | number) => {
    const chainId = String(network);
    if (!this.isNetwork(chainId)) throw new Error(`Undefined network "${chainId}"`);

    return this.networks[chainId];
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
