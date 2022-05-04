import container from '@container';
import BN from 'bignumber.js';
import dayjs from 'dayjs';

export interface Params {
  network: string;
  tolerance: number;
}

export function paramsVerify(params: any): params is Params {
  const { network, tolerance } = params;
  if (typeof network !== 'string' || !container.blockchain.ethereum.isNetwork(network)) {
    throw new Error('Invalid network');
  }
  if (typeof tolerance !== 'number') {
    throw new Error('Invalid tolerance multiplier');
  }

  return true;
}

export default async (params: Params) => {
  const network = container.blockchain.ethereum.byNetwork(params.network);
  const provider = network.provider();
  const currentGasPrice = await provider.getGasPrice();
  const database = container.database();

  const dates = Array.from(new Array(3).keys())
    .map(
      (i) =>
        `'${dayjs()
          .subtract(i + 1, 'week')
          .format('YYYY-MM-DD HH:00:00')}'`,
    )
    .join(', ');
  const historicalGasPrice = (await container.model
    .metricBlockchainTable()
    .column(database.raw(`AVG((data->>'gasPrice')::numeric) AS "avg"`))
    .where({
      blockchain: 'ethereum',
      network: params.network,
    })
    .andWhere(database.raw(`DATE_TRUNC('hour', "date") IN (${dates})`))
    .first()) as { avg: string | null } | undefined;
  if (!historicalGasPrice) return false;

  const { avg: avgGasPrice } = historicalGasPrice;
  if (!avgGasPrice) return false;

  return new BN(avgGasPrice).multipliedBy(1 + params.tolerance).gte(currentGasPrice.toString());
};
