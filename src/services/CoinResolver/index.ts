import container from '@container';
import BN from 'bignumber.js';

export type CoinResolverNamedChains = 'eth' | 'bsc' | 'avalanche' | 'polygon';
export type CoinResolverNumberChains = '1' | '56' | '137' | '43114';

export interface CoinResolverNativeDetails {
  decimals: number;
  symbol: string;
  name: string;
  logo: string | null;
  priceUSD: string;
}

export interface CoinResolverErc20Price {
  usd: string;
}

export class CoinResolverService {
  protected namedNetworkToNumber = (network: CoinResolverNamedChains): CoinResolverNumberChains => {
    switch (network) {
      case 'eth':
        return '1';
      case 'bsc':
        return '56';
      case 'polygon':
        return '137';
      case 'avalanche':
        return '43114';
      default:
        throw new Error(`unsupported network: ${network}`);
    }
  };

  protected cacheGet = async (tokenKey: string): Promise<string | null> => {
    const cache = container.cache();
    const key = `defihelper:token:${tokenKey}`;

    return new Promise((resolve) =>
      cache.get(key, (err, result) => {
        if (err || !result) return resolve(null);
        return resolve(result);
      }),
    );
  };

  protected cacheSet = (tokenKey: string, value: string): void => {
    const key = `defihelper:token:${tokenKey}`;
    container.cache().setex(key, 3600, value);
  };

  public erc20Price = async (
    blockchain: 'ethereum',
    network: 'eth' | 'bsc' | 'avalanche' | 'polygon',
    address: string,
  ): Promise<CoinResolverErc20Price> => {
    const key = `${blockchain}:${network}:${address}:price`;
    const moralis = await container.moralis().getWeb3API();

    const cachedPrice = await this.cacheGet(key);
    if (cachedPrice) {
      return {
        usd: cachedPrice,
      };
    }

    const result = await moralis.token.getTokenPrice({
      chain: network,
      address,
    });

    const usdPrice = new BN(result.usdPrice);
    this.cacheSet(key, usdPrice.toString(10));
    return {
      usd: usdPrice.toString(10),
    };
  };

  public native = async (
    blockchain: 'ethereum',
    network: 'eth' | 'bsc' | 'avalanche' | 'polygon',
  ): Promise<CoinResolverNativeDetails> => {
    const key = `${blockchain}:${network}:0x0:price`;
    let token;

    switch (network) {
      case 'eth':
        token = {
          decimals: 18,
          symbol: 'ETH',
          name: 'Ethereum',
          logo: null,
        };
        break;
      case 'bsc':
        token = {
          decimals: 18,
          symbol: 'BSC',
          name: 'Binance Smart Chain',
          logo: null,
        };
        break;
      case 'avalanche':
        token = {
          decimals: 18,
          symbol: 'AVAX',
          name: 'Avalanche',
          logo: null,
        };
        break;
      case 'polygon':
        token = {
          decimals: 18,
          symbol: 'MATIC',
          name: 'Polygon',
          logo: null,
        };
        break;

      default:
        throw new Error(`unknown chain: ${network}`);
    }

    let cachedPrice = await this.cacheGet(key);
    if (!cachedPrice) {
      cachedPrice = await container.blockchain.ethereum
        .byNetwork(this.namedNetworkToNumber(network))
        .priceFeedUSD();
      this.cacheSet(key, cachedPrice);
    }

    return {
      ...token,
      priceUSD: cachedPrice,
    };
  };
}

export function coinResolverServiceFactory() {
  return () => new CoinResolverService();
}
