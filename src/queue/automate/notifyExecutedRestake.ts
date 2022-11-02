import container from '@container';
import { Contract, contractTableName } from '@models/Automate/Entity';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import { Wallet, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  contract: string;
  amount: string;
}

export default async (process: Process) => {
  const { contract, amount } = process.task.params as Params;

  const automateContractWithWallet = (await container.model
    .automateContractTable()
    .innerJoin(walletTableName, `${walletTableName}.id`, `${contractTableName}.wallet`)
    .where(`${contractTableName}.id`, contract)
    .first()) as Contract & Wallet;

  if (!automateContractWithWallet) {
    throw new Error('No automate contract found');
  }

  const protocolContract = await container.model
    .contractTable()
    .where('id', automateContractWithWallet.contract)
    .first();

  if (!protocolContract) {
    throw new Error('Protocol contract not found');
  }

  const contactsByUser = await container.model
    .userContactTable()
    .where('broker', ContactBroker.Telegram)
    .andWhere('status', ContactStatus.Active)
    .andWhere('user', automateContractWithWallet.user);

  await Promise.all(
    contactsByUser.map((contact) => {
      return container.model.queueService().push('sendTelegramByContact', {
        contactId: contact.id,
        template: 'automateRestakeDone',
        params: {
          tokensUSDAmount: amount,
          poolName: protocolContract.name,
        },
      });
    }),
  );

  return process.done();
};
