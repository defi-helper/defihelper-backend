import { ICexService } from '@services/Cex';
import Binance from 'binance-api-node';

export default class implements ICexService {
  validateAccount = async (account: { apiKey: string; apiSecret: string }): Promise<boolean> => {
    const binance = Binance({
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
    });

    try {
      await binance.accountInfo();
    } catch {
      return false;
    }

    return true;
  };
}
