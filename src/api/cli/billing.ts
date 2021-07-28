import container from '@container';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';

interface NetworkContracts {
  [c: string]: {
    deployBlockNumber: number;
  };
}

export default async ([network = '1']: string[]) => {
  if (!isKey(contracts, network)) throw new Error('Invalid network');
  const networkContracts = contracts[network] as NetworkContracts;
  if (!isKey(networkContracts, 'Balance')) throw new Error('Balance not found in traget network');
  const { deployBlockNumber: from } = networkContracts.Balance;

  return Promise.all([
    container.model.queueService().push(
      'billingTransferScan',
      {
        blockchain: 'ethereum',
        network,
        step: 1000,
        from,
      },
      {
        colissionSign: `billingFeeOracle:ethereum:${network}`,
      },
    ),
    container.model.queueService().push(
      'billingClaimScan',
      {
        blockchain: 'ethereum',
        network,
        step: 1000,
        from,
      },
      {
        colissionSign: `billingFeeOracle:ethereum:${network}`,
      },
    ),
    container.model.queueService().push(
      'billingFeeOracle',
      {
        blockchain: 'ethereum',
        network,
      },
      {
        colissionSign: `billingFeeOracle:ethereum:${network}`,
      },
    ),
  ]);
};
