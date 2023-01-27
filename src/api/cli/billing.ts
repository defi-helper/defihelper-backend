import container from '@container';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';

export default async ([network = '1']: string[]) => {
  if (!isKey(contracts, network)) throw new Error('Invalid network');
  const networkContracts = contracts[network];

  const { blockNumber: storeFrom } = networkContracts.StoreUpgradable;
  return Promise.all([
    container.model.queueService().push(
      'billingFeeOracle',
      {
        blockchain: 'ethereum',
        network,
      },
      { scanner: true },
    ),
    container.model.queueService().push(
      'billingStoreScan',
      {
        blockchain: 'ethereum',
        network,
        step: 5000,
        from: storeFrom,
      },
      { scanner: true },
    ),
  ]);
};
