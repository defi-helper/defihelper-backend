import { Process } from '@models/Queue/Entity';
import container from '@container';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

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
    .whereIn('id', Object.keys(payload))
    .then((rows) => new Map(rows.map((row) => [row.id, row])));
  const contracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .whereIn('id', Object.values(payload).flat())
    .then((rows) => new Map(rows.map((row) => [row.id, row])));
  const telegramContacts = await container.model.userContactTable().where('user', userId);

  await Promise.all(
    telegramContacts.map(async (contact) => {
      return Promise.all(
        Object.keys(payload).map((walletId) => {
          const wallet = wallets.get(walletId);
          if (!wallet) {
            throw new Error(`Wallet ${walletId} not found`);
          }

          return container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'automationsMigrableContracts',
            params: {
              walletName: `${wallet.name} (${wallet.blockchain})`,
              items: payload[walletId].map((contractId) => {
                const item = contracts.get(contractId);
                if (!item) {
                  throw new Error(`Contract ${contractId} not found`);
                }

                container.model.contractService().doneMigrationReminder(item, wallet);
                return {
                  name: item.name,
                  id: item.id,
                };
              }),
            },
          });
        }),
      );
    }),
  );

  return process.done();
};
