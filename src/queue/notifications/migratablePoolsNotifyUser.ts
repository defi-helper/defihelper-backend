import { Process } from '@models/Queue/Entity';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import BN from 'bignumber.js';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';

interface Item {
  currentApy: string;
  boostedApy: string;
  name: string;
  id: string;
}

export interface Params {
  userId: string;
  payload: {
    [walletId: string]: string[];
  };
}

export default async (process: Process) => {
  const { userId, payload } = process.task.params as Params;

  const wallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .whereIn(`${walletTableName}.id`, Object.keys(payload))
    .then((rows) => new Map(rows.map((wallet) => [wallet.id, wallet])));
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .whereIn(`${contractTableName}.id`, Object.values(payload).flat())
    .then((rows) => new Map(rows.map((contract) => [contract.id, contract])));
  const contractsMetric = await container.model
    .metricContractRegistryTable()
    .whereIn('contract', Array.from(contracts.keys()))
    .then((rows) => new Map(rows.map((metric) => [metric.contract, metric])));
  const telegramContacts = await container.model
    .userContactTable()
    .where('user', userId)
    .where('broker', ContactBroker.Telegram)
    .where('status', ContactStatus.Active);

  await Promise.all(
    Object.keys(payload).map(async (walletId) => {
      const wallet = wallets.get(walletId);
      if (!wallet) return null;

      const items = await payload[walletId].reduce<Promise<Item[]>>(async (prev, contractId) => {
        const res = await prev;

        const contract = contracts.get(contractId);
        if (!contract) return res;

        const currentApy = new BN(contractsMetric.get(contractId)?.data.aprYear ?? '0');
        const boostedApy = await apyBoost(
          contract.blockchain,
          contract.network,
          10000,
          currentApy.toNumber(),
        ).then((v) => new BN(v));

        await container.model.contractService().doneMigrationReminder(contract, wallet);
        return [
          ...res,
          {
            currentApy: currentApy.multipliedBy(100).toFixed(2),
            boostedApy: boostedApy.multipliedBy(100).toFixed(2),
            name: contract.name,
            id: contract.id,
          },
        ];
      }, Promise.resolve([]));
      if (items.length === 0) return null;

      return Promise.all(
        telegramContacts.map(({ id: contactId }) =>
          container.model.queueService().push('sendTelegramByContact', {
            contactId,
            template: 'automationsMigrableContracts',
            params: {
              walletName: `${wallet.name} (${wallet.network} ${wallet.address})`,
              items,
            },
          }),
        ),
      );
    }),
  );

  return process.done();
};
