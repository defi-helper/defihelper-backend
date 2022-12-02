import { Process } from '@models/Queue/Entity';
import container from '@container';
import { triggerTableName } from '@models/Automate/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { transferTableName } from '@models/Billing/Entity';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import BN from 'bignumber.js';

interface TriggerItem {
  walletId: string;
  walletNetwork: string;
  triggerId: string;
  walletAddress: string;
}

export default async (process: Process) => {
  const { userId } = process.task.params as { userId: string };

  const user = await container.model.userTable().where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const database = container.database();
  const triggers = await container.model
    .automateTriggerTable()
    .columns<TriggerItem[]>(
      `${walletTableName}.id as walletId`,
      `${walletBlockchainTableName}.address as walletAddress`,
      `${walletBlockchainTableName}.network as walletNetwork`,
      `${triggerTableName}.id as triggerId`,
    )
    .innerJoin(walletTableName, `${triggerTableName}.wallet`, `${walletTableName}.id`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where('active', true)
    .whereNull(`${walletTableName}.deletedAt`)
    .andWhere(`${walletTableName}.user`, user.id);

  const walletsFunds = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id`)
    .column(`${walletTableName}.suspendReason`)
    .column(database.raw('coalesce(sum(amount), 0) as funds'))
    .innerJoin(walletBlockchainTableName, function () {
      this.on(`${walletBlockchainTableName}.blockchain`, '=', `${transferTableName}.blockchain`)
        .andOn(`${walletBlockchainTableName}.network`, '=', `${transferTableName}.network`)
        .andOn(`${walletBlockchainTableName}.address`, '=', `${transferTableName}.account`);
    })
    .innerJoin(walletTableName, `${walletTableName}.id`, `${walletBlockchainTableName}.id`)
    .whereIn(
      `${walletTableName}.id`,
      triggers.map(({ walletId }) => walletId),
    )
    .groupBy(`${walletTableName}.id`);

  const notifyBy = await triggers.reduce<Promise<TriggerItem | null>>(async (prev, t) => {
    const result = await prev;
    if (result !== null) return result;

    const walletFunds = walletsFunds.find((w) => {
      return w.id === t.walletId;
    });

    if (walletFunds?.suspendReason || !walletFunds) {
      return null;
    }

    const chainNativeUSD = new BN(
      await container.blockchain.ethereum.byNetwork(t.walletNetwork).nativeTokenPrice(),
    ).toNumber();

    return walletFunds.funds * chainNativeUSD <= 18 ? t : null;
  }, Promise.resolve(null));
  if (notifyBy === null) {
    return process.done();
  }

  const contacts = await container.model.userContactTable().where({
    user: user.id,
    status: ContactStatus.Active,
  });

  await Promise.all(
    contacts.map((contact) => {
      switch (contact.broker) {
        case ContactBroker.Email:
          return container.model.queueService().push('sendEmail', {
            email: contact.address,
            template: 'AutomateNotEnoughFunds',
            subject: '🚨Action required: service is not working',
            params: {},
            locale: user.locale,
          });

        case ContactBroker.Telegram:
          return container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'automateNotEnoughFunds',
            params: {
              visualizedWalletAddress: `${notifyBy.walletAddress.slice(
                0,
                6,
              )}...${notifyBy.walletAddress.slice(-4)} (${
                container.blockchain.ethereum.byNetwork(notifyBy.walletNetwork).name
              })`,
            },
          });

        default:
          throw new Error(`unexpected contact broker: ${contact.broker}`);
      }
    }),
  );

  return process.done();
};
