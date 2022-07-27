import { nodeInteraction } from '@waves/waves-transactions';
import { Factory } from '@services/Container';
import BN from 'bignumber.js';
import axios from 'axios';
import { Debank } from '@services/Debank';
import { Semafor } from '@services/Cache';
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
    public readonly cache: Factory<Semafor>,
    private readonly debank: Factory<Debank>,
    private readonly logger: Factory<ConsoleLogger>,
  ) {}

  async resolveUSDNPriceInUSD(): Promise<BN> {
    const price = await this.cache().synchronized(
      `defihelper:waves:usdn-usd-price`,
      async () => {
        const token = await this.debank().getToken(
          'eth',
          '0x674C6Ad92Fd080e4004b2312b45f796a192D27a0',
        ); // usdn

        return new BN(token.price).toString(10);
      },
      { ttl: 1800 },
    );

    return new BN(price);
  }

  async nodeRequest<T>(endpoint: string, path: string): Promise<T> {
    try {
      return await this.httpClient.get(endpoint + path).then((v) => v.data);
    } catch (e) {
      this.logger().error(`Waves gateway: ${endpoint + path}, message: ${e}`);
      throw e;
    }
  }

  async nativeBalance(address: string): Promise<BN> {
    return nodeInteraction.balance(address, this.nodeUrl).then((v) => new BN(v));
  }

  async assetPrice(address: string): Promise<BN | null> {
    // usdn/usdn pair bypass
    if (address === 'DG2xFkPdDwKUoBkzGAhQtLpSGzfXLiCYPEzeKH2Ad24p') {
      return this.resolveUSDNPriceInUSD();
    }

    // asset price in usdn
    const { bids } = await this.nodeRequest<{ bids: [price: number, amount: number][] }>(
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
  cache: Factory<Semafor>,
  debank: Factory<Debank>,
  logger: Factory<ConsoleLogger>,
): Factory<WavesNodeGateway> {
  return () => new WavesNodeGateway(cache, debank, logger);
}
