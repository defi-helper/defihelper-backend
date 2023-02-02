import container from '@container';
import { Contract, contractTableName } from '@models/Automate/Entity';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { contractBlockchainTableName } from '@models/Protocol/Entity';
import { Process } from '@models/Queue/Entity';
import { Wallet, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  contract: string;
  staked: string;
  earned: string;
  fee: string;
  total: string;
}

export default async (process: Process) => {
  const { contract, earned, total, fee } = process.task.params as Params;

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
    .innerJoin(
      contractBlockchainTableName,
      `${contractTableName}.id`,
      `${contractBlockchainTableName}.id`,
    )
    .where('id', automateContractWithWallet.contract)
    .first();

  if (!protocolContract) {
    throw new Error('Protocol contract not found');
  }

  const contactsByUser = await container.model
    .userContactTable()
    .where('broker', ContactBroker.Telegram)
    .where('status', ContactStatus.Active)
    .where('user', automateContractWithWallet.user);

  await Promise.all(
    contactsByUser.map((contact) => {
      return container.model.queueService().push('sendTelegramByContact', {
        contactId: contact.id,
        template: 'automateRestakeDone',
        params: {
          poolName: protocolContract.name,
          network: container.blockchain.ethereum.byNetwork(protocolContract.network).name,
          earned,
          total,
          fee,
        },
      });
    }),
  );

  return process.done();
};
