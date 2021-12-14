import container from '@container';
import { Factory } from '@services/Container';
import BN from 'bignumber.js';
import { RedisClient } from 'redis';

export class TreasuryService {
  constructor(
    public readonly cache: Factory<RedisClient>,
    public readonly prefix: string,
    public readonly ttl: number,
  ) {}

  protected async get(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.cache().get(key, (err, reply) => {
        if (err) return reject(err);

        return resolve(reply);
      });
    });
  }

  async getEthBalance(networkId: string) {
    const key = `${this.prefix}:${networkId}`;
    const cachedBalance = await this.get(key);
    if (cachedBalance !== null) return cachedBalance;

    const network = container.blockchain.ethereum.byNetwork(networkId);
    const contracts = network.dfhContracts();
    if (!contracts || !contracts.Treasury) return '0';

    const rawBalance = await network.provider().getBalance(contracts.Treasury.address);
    const balance = new BN(rawBalance.toString()).div(new BN(10).pow(18)).toString(10);
    this.cache().set(key, balance, () => {
      this.cache().expire(key, this.ttl);
    });

    return balance;
  }

  async getEthBalanceUSD(networkId: string) {
    const key = `${this.prefix}:${networkId}:usd`;
    const cachedBalance = await this.get(key);
    if (cachedBalance !== null) return cachedBalance;

    const balance = await this.getEthBalance(networkId);
    if (balance === '0') return '0';

    const network = container.blockchain.ethereum.byNetwork(networkId);
    const priceUSD = await network.nativeTokenPrice();
    const balanceUSD = new BN(balance).multipliedBy(priceUSD).toString(10);
    this.cache().set(key, balanceUSD, () => {
      this.cache().expire(key, this.ttl);
    });

    return balanceUSD;
  }
}
