import { ICexService } from '@services/Cex';
import Binance from 'node-binance-api';

export default class implements ICexService {
  validateAccount = async (account: { apiKey: string; apiSecret: string }): Promise<boolean> => {
    const binance = new Binance().options({
      APIKEY: account.apiKey,
      APISECRET: account.apiSecret,
      useServerTime: true,
      verbose: true,
    } as any);

    try {
      await binance.balance();
      return true;
    } catch {
      return false;
    }
  };
}
