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
    .andWhere(`${walletTableName}.user`, user.id);

  const walletsFunds = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id as id`)
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

  const notifyBy = await triggers.reduce<
    Promise<{ walletId: string; walletNetwork: string; triggerId: string } | null>
  >(async (prev, t) => {
    const result = await prev;
    if (result !== null) return result;

    const walletFunds = walletsFunds.find((w) => w.id === t.walletId);
    if (!walletFunds) {
      throw new Error('wallet funds must be found here');
    }

    const chainNativeUSD = new BN(
      await container.blockchain.ethereum.byNetwork(t.walletNetwork).nativeTokenPrice(),
    ).toNumber();

    return walletFunds.funds * chainNativeUSD - (1 + chainNativeUSD * 0.1) <= 0 ? t : null;
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
            template: 'automateNotEnoughFunds',
            subject: '🚨Action required: automate may be paused',
            locale: user.locale,
          });

        case ContactBroker.Telegram:
          if (!contact.params?.chatId) {
            return null;
          }

          return container.model.queueService().push('sendTelegram', {
            chatId: contact.params.chatId,
            locale: user.locale,
            template: 'automateNotEnoughFunds',
            params: {
              debugInfo: notifyBy.walletId.substring(0, 8),
            },
          });

        default:
          throw new Error(`unexpected contact broker: ${contact.broker}`);
      }
    }),
  );

  return process.done();
};
