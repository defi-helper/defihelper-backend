import axios, { AxiosInstance } from 'axios';

export type FollowerProvider = 'telegram';

export interface Options {
  host: string;
}

export class SocialStatsGateway {
  protected client: AxiosInstance;

  constructor({ host }: Options) {
    this.client = axios.create({
      baseURL: host,
    });
  }

  async follower(provider: FollowerProvider, channel: string) {
    const res = await this.client.get<{ followers: number }>(
      `/api/v1/follower/${provider}/${channel}`,
    );

    return res.data;
  }
}
