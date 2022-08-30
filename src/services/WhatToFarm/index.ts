import axios from 'axios';

export const networksMap = {
  fantom: '250',
  matic: '137',
  bsc: '56',
  avalanch: '43114',
  arbitrum: '42161',
  cronos: '25',
  eth: '1',
};

export interface LoginResponse {
  code: number;
  data: {
    access_token: string;
    refresh_token?: string;
    tokenExpired?: string;
    username: string;
  };
}

export interface PoolsListResponse {
  data: {
    list: {
      pairInfo: {
        lpToken: {
          network: {
            name: string;
          };
        };
        tokens: {
          address: string;
          symbol: string;
          name: string;
        }[];
      };
    }[];
    page: { page: number; size: number; total: number };
  };
}

export class WhatToFarmGateway {
  static readonly DEFAULT_URL = 'https://whattofarm.io/ext-api/v1';

  constructor(
    private readonly credentials: { email: string; password: string; username: string },
    public readonly url = WhatToFarmGateway.DEFAULT_URL,
  ) {}

  login(email?: string, username?: string, password?: string): Promise<LoginResponse> {
    return axios
      .post<LoginResponse>(
        `${this.url}/login`,
        JSON.stringify({
          email: email ?? this.credentials.email,
          username: username ?? this.credentials.username,
          password: password ?? this.credentials.password,
        }),
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      .then(({ data }) => data);
  }

  poolsList(token: string, page: number = 1): Promise<PoolsListResponse> {
    return axios
      .post<any>(
        `${this.url}/pair-stat?page=${page}&size=200&minLiquidity=10000&sortField=liquidity&sortDirection=desc`,
        {},
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        },
      )
      .then(({ data }) => data);
  }
}
