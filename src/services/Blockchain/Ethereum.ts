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
import { abi as uniswapRouterABI } from '@defihelper/networks/abi/UniswapV2Router.json';
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
      timeout: 600000,
    });
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
  rpcUrls,
  coingeckoPlatform,
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
  rpcUrls?: string[];
  network: NetworkConfig;
  coingeckoPlatform: string | null;
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
    rpcUrls,
    tokenPriceResolver,
    nativeTokenDetails,
    coingeckoPlatform,
    inspector: () => (inspectors.length > 0 ? new ethers.Wallet(inspectors[0], provider()) : null),
    consumers: () => signersFactory(consumers, provider()),
    dfhContracts: (): Record<string, { address: string } | undefined> | null =>
      isKey(dfhContracts, id) ? dfhContracts[id] : null,
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
    const cache = container.cache();
    const key = `token:ethereum:native:${coinApiId}:price`;
    const chainNativeUSD = await cache.promises.get(key).catch(() => null);
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
      await cache.promises.setex(key, 3600, usd);
      return usd;
    }

    return chainNativeUSD;
  };
}

function debankPriceFeed(network: string): { usd: TokenPriceFeedUSD } {
  return {
    usd: async (address: string) => {
      const key = `ethereum:${network}:${address}:price`;

      const cachedPrice = await container
        .cache()
        .promises.get(key)
        .catch(() => null);
      if (cachedPrice) {
        return cachedPrice;
      }

      const { price } = await container.debank().getToken(network, address);
      await container.cache().promises.setex(key, 3600, price.toString());

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
  wrapped: string | null;
}

export interface Config {
  eth: NetworkConfig;
  aurora: NetworkConfig;
  ethRopsten: NetworkConfig;
  ethRinkeby: NetworkConfig;
  ethGoerli: NetworkConfig;
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
        wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.eth,
      coingeckoPlatform: 'ethereum',
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
        wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.ethRopsten,
      coingeckoPlatform: 'ethereum',
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
        wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.ethRinkeby,
      coingeckoPlatform: 'ethereum',
    }),
    '5': networkFactory({
      id: '5',
      testnet: true,
      name: 'Ethereum Goerli',
      icon: 'ethereumRegular',
      explorerURL: new URL('https://goerli.etherscan.io'),
      txExplorerURL: new URL('https://goerli.etherscan.io//tx'),
      walletExplorerURL: new URL('https://goerli.etherscan.io//address'),
      etherscanApiURL: null,
      getContractAbi: useEtherscanContractAbi('https://api-goerli.etherscan.io/api'),
      getAvgGasPrice: avgGasPriceFeedManual('2000000000'),
      nativeTokenPrice: coingeckoPriceFeedUSD('ethereum'),
      nativeTokenDetails: {
        decimals: 18,
        symbol: 'GoerliETH',
        name: 'Goerli Ethereum',
        wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.ethGoerli,
      coingeckoPlatform: 'ethereum',
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
        wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // todo check me
      },
      tokenPriceResolver: debankPriceFeed('10'),
      rpcUrls: ['https://mainnet.optimism.io'],
      network: this.parent.optimistic,
      coingeckoPlatform: 'optimistic-ethereum',
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
        wrapped: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
      },
      tokenPriceResolver: debankPriceFeed('25'),
      network: this.parent.cronos,
      coingeckoPlatform: 'cronos',
    }),
    '56': networkFactory({
      id: '56',
      testnet: false,
      name: 'BNB Chain',
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
        wrapped: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
      rpcUrls: [
        'https://bsc-dataseed.binance.org/',
        'https://bsc-dataseed1.defibit.io/',
        'https://bsc-dataseed1.ninicoin.io/',
      ],
      tokenPriceResolver: debankPriceFeed('56'),
      network: this.parent.bsc,
      coingeckoPlatform: 'binance-smart-chain',
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
        wrapped: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      },
      tokenPriceResolver: debankPriceFeed('137'),
      rpcUrls: ['https://rpc-mainnet.maticvigil.com/', 'https://rpc-mainnet.maticvigil.com/'],
      network: this.parent.polygon,
      coingeckoPlatform: 'polygon-pos',
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
        wrapped: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
      },
      tokenPriceResolver: debankPriceFeed('250'),
      rpcUrls: ['https://rpc.ftm.tools'],
      network: this.parent.fantom,
      coingeckoPlatform: 'fantom',
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
        wrapped: '0xAcc15dC74880C9944775448304B263D191c6077F',
      },
      tokenPriceResolver: debankPriceFeed('1284'),
      rpcUrls: ['https://rpc.api.moonbeam.network', 'https://rpc.api.moonbeam.network'],
      network: this.parent.moonriver,
      coingeckoPlatform: 'moonbeam',
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
        wrapped: '0x98878B06940aE243284CA214f92Bb71a2b032B8A',
      },
      tokenPriceResolver: debankPriceFeed('1285'),
      rpcUrls: ['https://rpc.moonriver.moonbeam.network', 'https://rpc.moonriver.moonbeam.network'],
      network: this.parent.moonriver,
      coingeckoPlatform: 'moonriver',
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
        wrapped: null,
      },
      tokenPriceResolver: debankPriceFeed('1'),
      network: this.parent.local,
      coingeckoPlatform: 'ethereum',
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
        wrapped: '',
      },
      tokenPriceResolver: debankPriceFeed('42161'),
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      network: this.parent.arbitrum,
      coingeckoPlatform: 'arbitrum-one',
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
        wrapped: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      },
      tokenPriceResolver: debankPriceFeed('43113'),
      network: this.parent.avalancheTestnet,
      coingeckoPlatform: 'avalanche',
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
        wrapped: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
      },
      tokenPriceResolver: debankPriceFeed('43114'),
      rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://api.avax.network/ext/bc/C/rpc'],
      network: this.parent.avalanche,
      coingeckoPlatform: 'avalanche',
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
        wrapped: '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB',
      },
      tokenPriceResolver: debankPriceFeed('1313161554'),
      network: this.parent.aurora,
      coingeckoPlatform: 'aurora',
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
        wrapped: '0xcf664087a5bb0237a0bad6742852ec6c8d69a27a',
      },
      tokenPriceResolver: debankPriceFeed('1666600000'),
      rpcUrls: [
        'https://api.harmony.one',
        'https://s1.api.harmony.one',
        'https://s2.api.harmony.one',
        'https://s3.api.harmony.one',
      ],
      network: this.parent.harmony,
      coingeckoPlatform: null,
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
    uniswapRouterABI,
    automateABI,
  };
}
