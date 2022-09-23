import { Factory } from '@services/Container';
import BigNumber from 'bignumber.js';

export class Numbers {
  formatMoney = (amount: string | number | BigNumber): string => {
    const result = new BigNumber(amount);

    if (result.lt(10)) return result.toFormat(0);

    if (result.lt(10_000)) return result.toFormat(0);

    if (result.lt(100_000)) return result.toFormat(0);

    if (result.lt(1_000_000)) return result.toFormat(0);

    if (result.isGreaterThanOrEqualTo(1_000_000_000)) {
      return `${result.div(1_000_000_000).toFormat(0)}B`;
    }

    return `${result.div(1_000_000).toFormat(0)}M`;
  };
}

export function numbersServiceFactory(): Factory<Numbers> {
  return () => new Numbers();
}
