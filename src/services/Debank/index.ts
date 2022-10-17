import { Factory } from '@services/Container';
import axios from 'axios';
import buildUrl from 'build-url';

export interface Token {
  id: string;
  chain: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  price: number;
  is_verified?: boolean;
  is_core?: boolean;
  is_wallet?: boolean;
  logo_url?: string;
}

export interface ProtocolListItem {
  id: string;
  chain: string;
  name: string;
  site_url: string;
  logo_url: string;
  tvl: number;
  portfolio_item_list: {
    detail_types: string[];
    detail: {
      supply_token_list?: (Token & { amount: number })[];
      borrow_token_list?: (Token & { amount: number })[];
      reward_token_list?: (Token & { amount: number })[];
      token_list?: (Token & { amount: number })[];
    };
  }[];
}

export class TemporaryOutOfService extends Error {
  constructor(m = 'debank api temporary out of service') {
    super(m);
  }
}

export class Debank {
  constructor(public readonly apiKey: string) {}

  public readonly chains = {
    eth: '1',
    bsc: '56',
    matic: '137',
    movr: '1285',
    avax: '43114',
    ftm: '250',
    arb: '42161',
    op: '10',
    cro: '25',
    mobm: '1284',
    aurora: '1313161554',
    hmy: '1666600000',
  };

  public chainResolver(chain: string | number): { named: string; numbered: string } | undefined {
    return Object.entries(this.chains)
      .map(([named, numbered]) => ({ named, numbered }))
      .find((v) => v.named === String(chain) || v.numbered === String(chain));
  }

  private apiRequest<T>(
    path: string,
    queryParams: Record<string, string>,
    paidWay: boolean = false,
  ): Promise<T> {
    const url = buildUrl(
      paidWay ? 'https://pro-openapi.debank.com' : 'https://openapi.debank.com',
      {
        path: `/v1/${path}`,
        queryParams,
      },
    );

    return axios
      .get(url, {
        headers: paidWay
          ? {
              AccessKey: this.apiKey,
            }
          : {},
      })
      .then(({ data }) => {
        if (data === null) {
          throw new Error('Debank didn`t found anything');
        }

        return data;
      })
      .catch((e) => {
        if (!e.response) {
          throw new TemporaryOutOfService();
        }

        throw new Error(`[Debank ${paidWay ? 'PAID' : 'NONPAID'}]: ${url}; ${e}`);
      });
  }

  async getToken(chainId: string, address: string) {
    const chain = this.chainResolver(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    return this.apiRequest<Token>('token', {
      id: address === '0x0000000000000000000000000000000000000000' ? chain.named : address,
      chain_id: chain.named,
    });
  }

  async getTokensOnWallet(wallet: string) {
    return this.apiRequest<(Token & { amount: number })[]>(
      'user/all_token_list',
      {
        id: wallet,
      },
      true,
    );
  }

  async getTokensOnWalletNetwork(wallet: string, chainId: string) {
    const chain = this.chainResolver(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    return this.apiRequest<(Token & { amount: number })[]>(
      'user/token_list',
      {
        id: wallet,
        chain_id: chain.named,
        is_all: 'true',
      },
      true,
    );
  }

  async getProtocolListWallet(wallet: string) {
    const response = await this.apiRequest<ProtocolListItem[]>(
      'user/all_complex_protocol_list',
      {
        id: wallet,
      },
      true,
    );

    return response ?? [];
  }
}

export function debankServiceFactory(apiKey: string): Factory<Debank> {
  return () => new Debank(apiKey);
}
