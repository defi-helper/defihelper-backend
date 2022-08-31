import { nodeInteraction } from '@waves/waves-transactions';
import { Factory } from '@services/Container';
import BN from 'bignumber.js';
import axios from 'axios';
import { Debank } from '@services/Debank';
import { PromisifyRedisClient, Semafor } from '@services/Cache';
import { ConsoleLogger } from '@services/Log';

interface Asset {
  id: string;
  amount: BN;
  name: string;
  symbol: string;
  decimals: number;
}

interface RIBalance {
  assetId: string;
  balance: number;
  issueTransaction?: {
    decimals: number;
    name: string;
  };
}

export class WavesNodeGateway {
  protected nodeUrl = 'https://nodes.wavesnodes.com';

  protected matcherUrl = 'https://matcher.waves.exchange';

  private httpClient = axios.create();

  constructor(
    public readonly semafor: Factory<Semafor>,
    public readonly cache: Factory<PromisifyRedisClient>,
    private readonly debank: Factory<Debank>,
    private readonly logger: Factory<ConsoleLogger>,
  ) {}

  async resolveUSDNPriceInUSD(): Promise<BN> {
    const cacheKey = 'defihelper:waves:usdn-usd-price:value';
    const price = await this.semafor().synchronized(
      `defihelper:waves:usdn-usd-price:sync`,
      async () => {
        const fromCache = await this.cache().promises.get(cacheKey);
        if (fromCache) return fromCache;

        const { price: tokenPrice } = await this.debank().getToken(
          'eth',
          '0x674C6Ad92Fd080e4004b2312b45f796a192D27a0',
        ); // usdn

        const tokenPriceString = new BN(tokenPrice).toString(10);
        await this.cache().promises.setex(cacheKey, 1800, tokenPriceString);

        return tokenPriceString;
      },
      { ttl: 5 },
    );

    return new BN(price);
  }

  async nodeRequest<T>(endpoint: string, path: string): Promise<T> {
    try {
      return await this.httpClient.get(endpoint + path).then(({ data }) => data);
    } catch (e) {
      this.logger().error(`Waves gateway: ${endpoint + path}, message: ${e}`);
      throw e;
    }
  }

  async nativeBalance(address: string): Promise<BN> {
    try {
      return await nodeInteraction.balance(address, this.nodeUrl).then((v) => new BN(v));
    } catch (e) {
      this.logger().error(`Waves gateway(waves lib) error, message: ${e}`);
      throw e;
    }
  }

  async assetPrice(address: string): Promise<BN | null> {
    // usdn/usdn pair bypass
    if (address === 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p') {
      return this.resolveUSDNPriceInUSD();
    }

    // asset price in usdn
    let bids: [price: number, amount: number][];
    try {
      bids = (
        await this.nodeRequest<{ bids: [price: number, amount: number][] }>(
          this.matcherUrl,
          `/api/v1/orderbook/${
            address === 'waves' ? address.toUpperCase() : address
          }/DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p?depth=1`,
        )
      ).bids;
    } catch {
      return null;
    }

    if (!bids.length) {
      return null;
    }

    return new BN(bids[0][0]).multipliedBy(await this.resolveUSDNPriceInUSD());
  }

  async assetsOnWallet(address: string): Promise<Asset[]> {
    const { balances } = await this.nodeRequest<{ balances: RIBalance[] }>(
      this.nodeUrl,
      `/assets/balance/${address}`,
    );

    const wavesTokensBalance = await this.nativeBalance(address);
    const assetsBalances = balances
      .map((item) => {
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
      .filter((item) => Boolean(item)) as Asset[];

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

export function wavesNodeGatewayFactory(
  semafor: Factory<Semafor>,
  cache: Factory<PromisifyRedisClient>,
  debank: Factory<Debank>,
  logger: Factory<ConsoleLogger>,
): Factory<WavesNodeGateway> {
  return () => new WavesNodeGateway(semafor, cache, debank, logger);
}
