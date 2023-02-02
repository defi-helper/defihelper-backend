import container from '@container';
import {
  ContactBroker,
  ContactStatus,
  NotificationStatus,
  NotificationType,
} from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';
import BN from 'bignumber.js';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

interface PositionToken {
  address: string;
  name: string;
  symbol: string;
  amount: string;
  amountUSD: string;
  price: {
    value: string;
    USD: string;
    lower: string;
    upper: string;
  };
}

interface Position {
  id: number;
  fee: number;
  token0: PositionToken;
  token1: PositionToken;
}

export interface Params {
  id: string;
  positions: Position[];
}

export default async (process: Process) => {
  const { id, positions } = process.task.params as Params;

  const metric = await container.model.metricWalletTable().where('id', id).first();
  if (!metric) {
    throw new Error('Metric not found');
  }
  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .where(`${walletTableName}.id`, metric.wallet)
    .first();
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  if (wallet.type === WalletBlockchainType.Contract) {
    const contract = await container.model.contractTable().where('id', metric.contract).first();
    if (contract) {
      await container.model.metricService().createWallet(
        contract,
        wallet,
        {
          token0Address: positions[0].token0.address.toLowerCase(),
          token0PriceLower: positions[0].token0.price.lower,
          token0PriceUpper: positions[0].token0.price.upper,
          token1Address: positions[0].token1.address.toLowerCase(),
          token1PriceLower: positions[0].token1.price.lower,
          token1PriceUpper: positions[0].token1.price.upper,
        },
        new Date(),
      );
    }
  }

  const notRewardedPositions = positions.filter(
    ({ token0 }) =>
      new BN(token0.price.value).lt(token0.price.lower) ||
      new BN(token0.price.value).gt(token0.price.upper),
  );
  if (notRewardedPositions.length === 0) {
    return process.done();
  }

  const isLocked = await container
    .cache()
    .promises.get(`defihelper:uni3-notification:positionsWithoutReward:${wallet.id}`);
  if (isLocked !== null) {
    return process.done();
  }
  const user = await container.model.userTable().where('id', wallet.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications <= 0) {
    return process.info('Not available notifications').done();
  }

  const contact = await container.model
    .userContactTable()
    .where('user', wallet.user)
    .where('broker', ContactBroker.Telegram)
    .where('status', ContactStatus.Active)
    .first();
  if (!contact) {
    return process.done();
  }
  const [position] = notRewardedPositions;
  await Promise.all([
    container.model.queueService().push('sendTelegramByContact', {
      contactId: contact.id,
      template: 'uni3PositionWithoutReward',
      params: {
        walletName: wallet.name,
        tokenSymbol: position.token0.symbol,
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
    container.cache().promises.setex(
      `defihelper:uni3-notification:positionsWithoutReward:${wallet.id}`,
      86400, // 1 day
      dayjs().format('YYYY-MM-DD HH:mm:ss'),
    ),
  ]);

  return process.done();
};
