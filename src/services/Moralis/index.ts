import Moralis from 'moralis/node';
import axios from 'axios';
import buildUrl from 'build-url';

export interface MoralisRestAPIRequestResponse {
  code: number;
  data: any;
}

export interface MoralisRestAPITypeERC20TokenPrice {
  nativePrice: {
    value: string;
    decimals: number;
    name: string;
    symbol: string;
  };
  usdPrice: number;
  exchangeAddress: string;
  exchangeName: string;
}

export interface MoralisRestAPITypeAccountERC20Tokens {
  token_address: string;
  name: string;
  symbol: string;
  logo: string | null;
  thumbnail: string | null;
  decimals: string;
  balance: string;
}

export enum MoralisRestAPIChain {
  eth = 'eth',
  bsc = 'bsc',
  avalanche = 'avalanche',
  polygon = 'polygon',
}

export class MoralisRestApi {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async ERC20TokenPrice(
    address: string,
    chain: MoralisRestAPIChain,
  ): Promise<MoralisRestAPITypeERC20TokenPrice> {
    const r = await this.request(`erc20/${address}/price`, { chain });
    return r.data as MoralisRestAPITypeERC20TokenPrice;
  }

  public async accountERC20Tokens(
    address: string,
    chain: MoralisRestAPIChain,
  ): Promise<MoralisRestAPITypeAccountERC20Tokens[]> {
    const r = await this.request(`${address}/erc20`, { chain });
    return r.data as MoralisRestAPITypeAccountERC20Tokens[];
  }

  protected request = async (
    procedure: string,
    queryParams: { [key: string]: string } = {},
    httpMethod: 'post' | 'get' = 'get',
  ): Promise<MoralisRestAPIRequestResponse> => {
    const url = buildUrl('https://deep-index.moralis.io', {
      path: `api/v2/${procedure}`,
      queryParams,
    });

    const response = await axios[httpMethod](url, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (response.status !== 200) {
      throw new Error(`Unable to resolve ${procedure}, code ${response.status} :sowwy:`);
    }

    return {
      code: response.status,
      data: response.data,
    };
  };
}

export class MoralisService {
  private isMoralisInitialized = false;

  private readonly config: Moralis.StartOptions;

  constructor(config: Moralis.StartOptions) {
    this.config = config;
  }

  async init() {
    if (this.isMoralisInitialized) {
      return;
    }

    await Moralis.start(this.config);
    this.isMoralisInitialized = true;
  }

  getRestAPI() {
    return new MoralisRestApi(this.config.moralisSecret as string);
  }

  async getWeb3API() {
    await this.init();
    return Moralis.Web3API;
  }
}

export function moralisServiceFactory(config: Moralis.StartOptions) {
  return () => new MoralisService(config);
}
