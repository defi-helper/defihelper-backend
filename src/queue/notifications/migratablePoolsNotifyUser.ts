import { Process } from '@models/Queue/Entity';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { apyBoost } from '@services/RestakeStrategy';
import BN from 'bignumber.js';

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
    .then((rows) => new Map(rows.map((row) => [row.id, row])));
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .whereIn(`${contractTableName}.id`, Object.values(payload).flat())
    .then((rows) => new Map(rows.map((row) => [row.id, row])));
  const telegramContacts = await container.model.userContactTable().where('user', userId);

  await Promise.all(
    telegramContacts.map(async (contact) => {
      return Promise.all(
        Object.keys(payload).map(async (walletId) => {
          const wallet = wallets.get(walletId);
          if (!wallet) {
            throw new Error(`Wallet ${walletId} not found`);
          }

          const items = await Promise.all(
            payload[walletId].map(async (contractId) => {
              const item = contracts.get(contractId);
              if (!item) {
                throw new Error(`Contract ${contractId} not found`);
              }

              const currentApy = item.metric.aprYear ?? '0';
              const boostedApy = await apyBoost(
                item.blockchain,
                item.network,
                10000,
                new BN(currentApy).toNumber(),
              );

              if (new BN(boostedApy).minus(currentApy).lte(1)) {
                return null;
              }

              await container.model.contractService().doneMigrationReminder(item, wallet);
              return {
                currentApy: new BN(currentApy).toFixed(2),
                boostedApy: new BN(boostedApy).multipliedBy(100).toFixed(2),
                name: item.name,
                id: item.id,
              };
            }),
          );

          return container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'automationsMigrableContracts',
            params: {
              walletName: `${wallet.name} (${wallet.blockchain})`,
              items: items.filter((v) => v),
            },
          });
        }),
      );
    }),
  );

  return process.done();
};
