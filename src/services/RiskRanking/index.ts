import { Factory } from '@services/Container';
import axios from 'axios';
import buildUrl from 'build-url';

export interface CoinInfo {
  id: string;
  name: string;
  volatility: {
    quantile_volatility_scoring: number;
  };
  reliability: {
    quantile_reliability_scoring: number;
  };
  profitability: {
    quantile_profitability_scoring: number;
  };
  total: {
    ranking: 'green' | 'red' | 'yellow';
    quantile_scoring: number;
  };
}

export class TemporaryOutOfService extends Error {
  constructor(m = 'risk ranking api temporary out of service') {
    super(m);
  }
}

enum RequestType {
  POST = 'post',
  GET = 'get',
}

export interface IRiskRankingGateway {
  getCoinInfo(coingeckoId: string): Promise<CoinInfo | null>;
}

export class RiskRanking implements IRiskRankingGateway {
  constructor(public readonly url: string) {}

  private apiRequest<T>(
    type: RequestType,
    path: string,
    queryParams: Record<string, string>,
  ): Promise<T> {
    const url = buildUrl(this.url, {
      path: `/${path}`,
      queryParams,
    });

    return axios[type](url)
      .then(({ data }) => {
        if (data === null) {
          throw new Error('Api didn`t found anything');
        }

        return data;
      })
      .catch((e) => {
        if (!e.response) {
          throw new TemporaryOutOfService();
        }

        throw new Error(`[Risk ranking]: ${url}; ${e}`);
      });
  }

  async getCoinInfo(coingeckoId: string) {
    const response = await this.apiRequest<CoinInfo | { status_code: number }>(
      RequestType.GET,
      'coin-data',
      {
        id: coingeckoId,
      },
    );

    if ('status_code' in response) {
      return null;
    }

    return response;
  }
}

class NullService implements IRiskRankingGateway {
  constructor(public readonly url: string) {}

  // eslint-disable-next-line
  async getCoinInfo() {
    return null;
  }
}

export function riskRankingFactory(url: string): Factory<IRiskRankingGateway> {
  return () => (url ? new RiskRanking(url) : new NullService(url));
}
