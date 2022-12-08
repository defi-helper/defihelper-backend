import { Factory } from '@services/Container';
import axios from 'axios';
import buildUrl from 'build-url';

export type RawRiskRank = 'green' | 'red' | 'yellow';
export interface CoinInfo {
  id: string;
  name: string;
  volatility: {
    quantile_volatility_scoring: number;
    ranking_volatility: RawRiskRank;
  };
  reliability: {
    quantile_reliability_scoring: number;
    ranking_reliability: RawRiskRank;
  };
  profitability: {
    quantile_profitability_scoring: number;
    ranking_profitability: RawRiskRank;
  };
  total: {
    ranking: RawRiskRank;
    quantile_scoring: number;
  };
}

export interface PoolRisking {
  score: number;
  ranking_score: RawRiskRank;
  volatility_quantile: number;
  reliability_quantile: number;
  profitability_quantile: number;
  total_quantile: number;
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
  getPoolScoring(pools: { [coinId: string]: number }): Promise<PoolRisking | null>;
}

export class RiskRanking implements IRiskRankingGateway {
  constructor(public readonly url: string) {}

  private apiRequest<T>(
    type: RequestType,
    path: string,
    queryParams: Record<string, string>,
    payload: Record<string, string | number> = {},
  ): Promise<T> {
    const url = buildUrl(this.url, {
      path: `/${path}`,
      queryParams,
    });

    return axios[type](url, payload)
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

  async getPoolScoring(pools: { [coinId: string]: number }) {
    const response = await this.apiRequest<PoolRisking | { status_code: number }>(
      RequestType.POST,
      'cumulative-scorring',
      {},
      pools,
    );

    if ('status_code' in response) {
      return null;
    }

    return response;
  }
}

class NullService implements IRiskRankingGateway {
  // eslint-disable-next-line
  async getCoinInfo() {
    return null;
  }

  // eslint-disable-next-line
  async getPoolScoring() {
    return null;
  }
}

export function riskRankingFactory(url: string): Factory<IRiskRankingGateway> {
  return () => (url ? new RiskRanking(url) : new NullService());
}
