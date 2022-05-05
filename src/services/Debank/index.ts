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

interface ProtocolListItem {
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

export class Debank {
  public readonly chains: { [named: string]: string } = {
    eth: '1',
    bsc: '56',
    matic: '137',
    movr: '1285',
    avax: '43114',
    ftm: '250',
    arb: '42161',
    op: '10',
    cro: '25',
  };

  public chainResolver = (
    chain: string | number,
  ): { named: string; numbered: string } | undefined => {
    return Object.entries(this.chains)
      .map(([named, numbered]) => ({ named, numbered }))
      .find((v) => v.named === String(chain) || v.numbered === String(chain));
  };

  private apiRequest = (path: string, queryParams: Record<string, string>): any => {
    const url = buildUrl('https://openapi.debank.com', {
      path: `/v1/${path}`,
      queryParams,
    });

    return axios.get(url).then((response) => {
      const r = response.data;
      if (r === null) {
        throw new Error('Debank didn`t found anything');
      }

      return r;
    });
  };

  getToken = async (chainId: string, address: string): Promise<Token> => {
    const chain = this.chainResolver(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    return this.apiRequest('token', {
      id: address === '0x0000000000000000000000000000000000000000' ? chain.named : address,
      chain_id: chain.named,
    });
  };

  getTokensOnWallet = async (wallet: string): Promise<(Token & { amount: number })[]> => {
    return this.apiRequest('user/token_list', {
      id: wallet,
    });
  };

  getTokensOnWalletNetwork = async (
    wallet: string,
    chainId: string,
  ): Promise<(Token & { amount: number })[]> => {
    const chain = this.chainResolver(chainId);
    if (!chain) {
      throw new Error(`Unknown chain: ${chainId}`);
    }

    return this.apiRequest('user/token_list', {
      id: wallet,
      chain_id: chain.named,
      is_all: 'true',
    });
  };

  getProtocolListWallet = async (wallet: string): Promise<ProtocolListItem[]> => {
    return (
      this.apiRequest('user/complex_protocol_list', {
        id: wallet,
      }) ?? []
    );
  };
}

export function debankServiceFactory(): Factory<Debank> {
  return () => new Debank();
}
