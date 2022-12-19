import { Process, Task } from '@models/Queue/Entity';
import contracts from '@defihelper/networks/contracts.json';
import container from '@container';
import { isKey } from '@services/types';

export default async (process: Process) => {
  const tasks = await container.model
    .queueTable()
    .whereIn('handler', ['billingClaimScan', 'billingFeeOracle', 'billingStoreScan']);
  const tasksMap = tasks.reduce((map, task) => {
    const { blockchain, network } = task.params as { blockchain: string; network: string };
    if (blockchain !== 'ethereum') return map; // Skip not ethereum tasks

    return {
      ...map,
      [network]: {
        ...(map[network] ?? {}),
        [task.handler]: task,
      },
    };
  }, {} as { [network: string]: { [handler: string]: Task } });

  const { mode } = container.parent;
  const queueService = container.model.queueService();
  const { ethereum } = container.blockchain;
  await Promise.all(
    Object.entries(contracts).map(async ([network, networkContracts]) => {
      if (!ethereum.isNetwork(network)) return [];
      if (
        ethereum.byNetwork(network).testnet &&
        !(mode === 'development' && ['5', '43113'].includes(network))
      ) {
        return [];
      }

      const pool = [];
      if ('Balance' in networkContracts) {
        const { blockNumber: balanceFrom } = networkContracts.Balance;

        if (!tasksMap[network]?.billingClaimScan) {
          pool.push(
            queueService.push(
              'billingClaimScan',
              {
                blockchain: 'ethereum',
                network,
                step: 5000,
                from: balanceFrom,
                lag: ['43114'].includes(network) ? 4 : 1,
              },
              { scanner: true },
            ),
          );
        }
      }

      if (isKey(networkContracts, 'StoreUpgradable')) {
        const { blockNumber: storeFrom } = networkContracts.StoreUpgradable;

        if (!tasksMap[network]?.billingFeeOracle) {
          pool.push(
            queueService.push(
              'billingStoreScan',
              {
                blockchain: 'ethereum',
                network,
                step: 5000,
                from: storeFrom,
                lag: ['43114'].includes(network) ? 4 : 1,
              },
              { scanner: true },
            ),
          );
        }
      }

      if (!tasksMap[network]?.billingFeeOracle) {
        pool.push(
          queueService.push(
            'billingFeeOracle',
            {
              blockchain: 'ethereum',
              network,
            },
            { scanner: true },
          ),
        );
      }

      return Promise.all(pool);
    }),
  );

  return process.done();
};
