import { Factory } from '@services/Container';
import BinanceCexService from '@services/Cex/Binance';

export interface ICexService {
  validateAccount(account: Record<string, any>): Promise<boolean>;
}

export class CexServicesProviderService {
  binance = () => new BinanceCexService();
}

export function cexServicesProviderFactory(): Factory<CexServicesProviderService> {
  return () => new CexServicesProviderService();
}
