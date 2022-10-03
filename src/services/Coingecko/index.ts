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

    const res = await axios.get(url);
    if (res.data.error) {
      throw new Error(res.data.error);
    }

    return res.data;
  };

  async findCoinByAddress(platformId: string, address: string) {
    return this.apiRequest<{ id: string }>(`coins/${platformId}/contract/${address}`);
  }
}
