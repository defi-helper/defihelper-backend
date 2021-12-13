import Moralis from 'moralis/node';
import container from '@container';
import BN from 'bignumber.js';

export interface CoinResolverTokenDetails {
  decimals: number;
  symbol: string;
  name: string;
  logo: string | null;
  priceUSD: BN;
}

export class CoinResolverService {
  public erc20 = async (
    blockchain: 'ethereum',
    network: string,
    address: string,
  ): Promise<CoinResolverTokenDetails> => {
    const moralis = await container.moralis().getWeb3API();
    let chain;

    

    const token = moralis.token.getTokenPrice({
      chain,
      address: token.token_address,
    });

  }

  public native = async (
    blockchain: 'ethereum',
    network: string,
  ): Promise<CoinResolverTokenDetails> => {
    switch (network) {
      case '1':
        return {
          decimals: 18,
          symbol: 'ETH',
          name: 'Ethereum',
          logo: null,
          priceUSD: new BN(await container.blockchain.ethereum.byNetwork(network).priceFeedUSD()),
        };
      case '56':
        return {
          decimals: 18,
          symbol: 'BSC',
          name: 'Binance Smart Chain',
          logo: null,
          priceUSD: new BN(await container.blockchain.ethereum.byNetwork(network).priceFeedUSD()),
        };
      case '43114':
        return {
          decimals: 18,
          symbol: 'AVAX',
          name: 'Avalanche',
          logo: null,
          priceUSD: new BN(await container.blockchain.ethereum.byNetwork(network).priceFeedUSD()),
        };
      case '137':
        return {
          decimals: 18,
          symbol: 'MATIC',
          name: 'Polygon',
          logo: null,
          priceUSD: new BN(await container.blockchain.ethereum.byNetwork(network).priceFeedUSD()),
        };

      default:
        throw new Error(`unknown chain: ${network}`);
    }
  };
}

export function moralisServiceFactory(config: Moralis.StartOptions) {
  return () => new CoinResolverService(config);
}
