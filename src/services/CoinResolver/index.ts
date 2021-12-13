import container from '@container';
import BN from 'bignumber.js';

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
    network: string,
    address: string,
  ): Promise<CoinResolverErc20Price> => {
    let chain: 'eth' | 'bsc' | 'avalanche' | 'polygon';
    const key = `${blockchain}:${network}:${address}:price`;
    const moralis = await container.moralis().getWeb3API();

    const cachedPrice = await this.cacheGet(key);
    if (cachedPrice) {
      return {
        usd: cachedPrice,
      };
    }

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

    const result = await moralis.token.getTokenPrice({
      chain,
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
    network: string,
  ): Promise<CoinResolverNativeDetails> => {
    const key = `${blockchain}:${network}:0x0:price`;
    let token;

    switch (network) {
      case '1':
        token = {
          decimals: 18,
          symbol: 'ETH',
          name: 'Ethereum',
          logo: null,
        };
        break;
      case '56':
        token = {
          decimals: 18,
          symbol: 'BSC',
          name: 'Binance Smart Chain',
          logo: null,
        };
        break;
      case '43114':
        token = {
          decimals: 18,
          symbol: 'AVAX',
          name: 'Avalanche',
          logo: null,
        };
        break;
      case '137':
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
      cachedPrice = await container.blockchain.ethereum.byNetwork(network).priceFeedUSD();
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
