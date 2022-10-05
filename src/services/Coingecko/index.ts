import axios from 'axios';
import buildUrl from 'build-url';

export class Coingecko {
  private apiRequest = async <T>(
    path: string,
    queryParams: Record<string, string> = {},
  ): Promise<T> => {
    const url = buildUrl('https://api.coingecko.com', {
      path: `/api/v3/${path}`,
      queryParams,
    });

    return axios.get(url).then(({ data }) => data);
  };

  async findCoinByAddress(platformId: string, address: string) {
    const res = await this.apiRequest<{ error: string } | { id: string }>(
      `coins/${platformId}/contract/${address}`,
    );
    if ('error' in res) {
      if (res.error === 'Could not find coin with the given id') {
        return null;
      }

      throw new Error(res.error);
    }

    return res;
  }
}
