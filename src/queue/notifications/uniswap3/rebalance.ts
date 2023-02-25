import container from '@container';
import { Process } from '@models/Queue/Entity';
import BN from 'bignumber.js';
import {
  ContactBroker,
  ContactStatus,
  NotificationStatus,
  NotificationType,
} from '@models/Notification/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

interface Params {
  id: string;
  position: {
    token0: {
      price: {
        lower: string;
        upper: string;
        value: string;
      };
    };
    token1: { symbol: string };
  };
}

export default async (process: Process) => {
  const { id, position } = process.task.params as Params;

  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .where(`${walletTableName}.id`, id)
    .first();
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const user = await container.model.userTable().where('id', wallet.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications <= 0) {
    return process.info('Not available notifications').done();
  }

  const automate = await container.model
    .automateContractTable()
    .where('contractWallet', wallet.id)
    .first();
  if (!automate) {
    throw new Error('Automate not found');
  }

  const pool = await container.model.contractTable().where('id', automate.contract).first();
  if (!pool) {
    throw new Error('Pool not found');
  }

  const networkName = container.blockchain.ethereum.byNetwork(wallet.network).name;

  const contact = await container.model
    .userContactTable()
    .where('user', wallet.user)
    .where('broker', ContactBroker.Telegram)
    .where('status', ContactStatus.Active)
    .first();
  if (!contact) {
    return process.done();
  }

  await Promise.all([
    container.model.queueService().push('sendTelegramByContact', {
      contactId: contact.id,
      template: 'uni3PositionRebalance',
      params: {
        name: `${pool.name} (${networkName})`,
        tokenSymbol: position.token1.symbol,
        lowerPrice: new BN(position.token0.price.lower).toFixed(4).replace(/0+$/, ''),
        upperPrice: new BN(position.token0.price.upper).toFixed(4).replace(/0+$/, ''),
        currentPrice: new BN(position.token0.price.value).toFixed(4).replace(/0+$/, ''),
      },
    }),
    container.model
      .notificationService()
      .create(
        contact,
        { type: NotificationType.uni3PositionWithoutReward, payload: {} },
        NotificationStatus.processed,
      ),
  ]);

  return process.done();
};
