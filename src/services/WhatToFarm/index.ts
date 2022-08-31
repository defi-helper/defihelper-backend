import axios from 'axios';

export interface LoginResponse {
  code: number;
  data: {
    access_token: string;
    refresh_token?: string;
    tokenExpired?: string;
    username: string;
  };
}

export class WhatToFarmGateway {
  static readonly DEFAULT_URL = 'https://whattofarm.io/ext-api/v1';

  constructor(public readonly url = WhatToFarmGateway.DEFAULT_URL) {}

  login(email: string, username: string, password: string): Promise<LoginResponse> {
    return axios
      .post<LoginResponse>(`${this.url}/login`, JSON.stringify({ email, username, password }), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
      .then(({ data }) => data);
  }
}
