import { nodeInteraction } from '@waves/waves-transactions';
import { Factory } from '@services/Container';
import BN from 'bignumber.js';
import axios from 'axios';

interface Asset {
  id: string;
  balance: BN;
  name: string;
  chain: 'waves';
  symbol: string;
  decimals: number;
}

export class WavesNodeService {
  protected nodeUrl = 'https://nodes.wavesnodes.com';
  private httpClient;

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.nodeUrl,
    });
  }

  async nodeRequest(path: string): Promise<any> {
    const request = await this.httpClient.get(path);
    return request.data;
  }

  async nativeBalance(address: string): Promise<BN> {
    const balance = await nodeInteraction.balance(address, this.nodeUrl);
    return new BN(balance);
  }

  async assetPrice(address: string): Promise<BN | null> {
    const { asks } = await this.nodeRequest(
      `/api/v1/orderbook/${address}/DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p`,
    );

    if (!asks || !asks.length) {
      return null;
    }

    return new BN(asks[0]);
  }

  async assetsOnWallet(address: string): Promise<Asset[]> {
    const { balances } = await this.nodeRequest(`/assets/balance/${address}`);
    return balances.map((item: any) => {
      return {
        id: item.assetId,
        name: item.issueTransaction.name,
        balance: item.balances,
        chain: 'waves',
        symbol: item.issueTransaction.name
          .match(/\b([A-Za-z0-9])/g)
          .join('')
          .toUpperCase(),
        decimals: item.issueTransaction.decimals,
      };
    });
  }
}

export function wavesNodeServiceFactory(): Factory<WavesNodeService> {
  return () => new WavesNodeService();
}
