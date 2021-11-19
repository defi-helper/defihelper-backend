import { Process, Task } from '@models/Queue/Entity';
import contracts from '@defihelper/networks/contracts.json';
import container from '@container';
import { isKey } from '@services/types';

export default async (process: Process) => {
  const tasks = await container.model
    .queueTable()
    .whereIn('handler', [
      'billingTransferScan',
      'billingClaimScan',
      'billingFeeOracle',
      'billingStoreScan',
    ]);
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

  const queueService = container.model.queueService();
  await Promise.all(
    Object.entries(contracts).map(async ([network, networkContracts]) => {
      const pool = [];
      if (isKey(networkContracts, 'Balance')) {
        const { deployBlockNumber: balanceFrom } = networkContracts.Balance;

        if (!tasksMap[network]?.billingTransferScan) {
          pool.push(
            queueService.push(
              'billingTransferScan',
              {
                blockchain: 'ethereum',
                network,
                step: 1000,
                from: balanceFrom,
                lag: ['43114'].includes(network) ? 4 : 1,
              },
              {
                colissionSign: `billingTransferScan:ethereum:${network}`,
              },
            ),
          );
        }
        if (!tasksMap[network]?.billingClaimScan) {
          pool.push(
            queueService.push(
              'billingClaimScan',
              {
                blockchain: 'ethereum',
                network,
                step: 1000,
                from: balanceFrom,
                lag: ['43114'].includes(network) ? 4 : 1,
              },
              {
                colissionSign: `billingClaimScan:ethereum:${network}`,
              },
            ),
          );
        }
      }

      if (isKey(networkContracts, 'Store')) {
        const { deployBlockNumber: storeFrom } = networkContracts.Store;

        if (!tasksMap[network]?.billingFeeOracle) {
          pool.push(
            queueService.push(
              'billingStoreScan',
              {
                blockchain: 'ethereum',
                network,
                step: 1000,
                from: storeFrom,
                lag: ['43114'].includes(network) ? 4 : 1,
              },
              {
                colissionSign: `billingStoreScan:ethereum:${network}`,
              },
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
            {
              colissionSign: `billingFeeOracle:ethereum:${network}`,
            },
          ),
        );
      }

      return Promise.all(pool);
    }),
  );

  return process.done();
};
