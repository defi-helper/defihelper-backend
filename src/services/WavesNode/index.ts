import { nodeInteraction } from '@waves/waves-transactions';
import { Factory } from '@services/Container';
import BN from 'bignumber.js';
import axios from 'axios';
import { Debank } from '@services/Debank';
import { PromisifyRedisClient } from '@services/Cache';

interface Asset {
  id: string;
  amount: BN;
  name: string;
  symbol: string;
  decimals: number;
}

export class WavesNodeService {
  protected nodeUrl = 'https://nodes.wavesnodes.com';
  protected matcherUrl = 'https://matcher.waves.exchange';
  private httpClient = axios.create();

  constructor(
    public readonly cache: Factory<PromisifyRedisClient>,
    private readonly debank: Factory<Debank>,
  ) {}

  async resolveUSDNPriceInUSD(): Promise<BN> {
    const key = 'defihelper:waves:usdn-usd-price';
    const cachedPrice = await this.cache().promises.get(key);
    if (cachedPrice) {
      return new BN(cachedPrice);
    }

    const token = await this.debank().getToken('eth', '0x674C6Ad92Fd080e4004b2312b45f796a192D27a0'); // usdn

    await this.cache().promises.setex(key, 1800, new BN(token.price).toString(10));
    return new BN(token.price);
  }

  async nodeRequest(endpoint: string, path: string): Promise<any> {
    const request = await this.httpClient.get(endpoint + path);
    return request.data;
  }

  async nativeBalance(address: string): Promise<BN> {
    const balance = await nodeInteraction.balance(address, this.nodeUrl);
    return new BN(balance);
  }

  async assetPrice(address: string): Promise<BN | null> {
    // usdn/usdn pair bypass
    if (address === 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p') {
      return this.resolveUSDNPriceInUSD();
    }

    // asset price in usdn
    const { bids } = await this.nodeRequest(
      this.matcherUrl,
      `/api/v1/orderbook/${
        address === 'waves' ? address.toUpperCase() : address
      }/DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p?depth=1`,
    );

    if (!bids || !bids.length) {
      return null;
    }

    return new BN(bids[0][0]).multipliedBy(await this.resolveUSDNPriceInUSD());
  }

  async assetsOnWallet(address: string): Promise<Asset[]> {
    const { balances } = await this.nodeRequest(this.nodeUrl, `/assets/balance/${address}`);
    const wavesTokensBalance = await this.nativeBalance(address);

    const assetsBalances = balances
      .map((item: any) => {
        if (!item.issueTransaction) {
          return null;
        }

        return {
          id: item.assetId,
          name: item.issueTransaction.name,
          amount: new BN(item.balance).div(`1e${item.issueTransaction.decimals}`),
          symbol: item.issueTransaction.name.toUpperCase(),
          decimals: item.issueTransaction.decimals,
        };
      })
      .filter((item: any) => Boolean(item));

    return [
      ...assetsBalances,
      {
        id: 'waves',
        name: 'WAVES',
        amount: wavesTokensBalance.div(`1e8`),
        symbol: 'WAVES',
        decimals: 8,
      },
    ];
  }
}

export function wavesNodeServiceFactory(
  cache: Factory<PromisifyRedisClient>,
  debank: Factory<Debank>,
): Factory<WavesNodeService> {
  return () => new WavesNodeService(cache, debank);
}
