import container from '@container';
import { Process } from '@models/Queue/Entity';
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
        positions.length > 0
          ? {
              token0Address: positions[0].token0.address.toLowerCase(),
              token0Price: positions[0].token0.price.value,
              token0PriceLower: positions[0].token0.price.lower,
              token0PriceUpper: positions[0].token0.price.upper,
              token1Address: positions[0].token1.address.toLowerCase(),
              token1Price: positions[0].token1.price.value,
              token1PriceLower: positions[0].token1.price.lower,
              token1PriceUpper: positions[0].token1.price.upper,
            }
          : {
              token0Address: '0x0000000000000000000000000000000000000000',
              token0Price: '0',
              token0PriceLower: '0',
              token0PriceUpper: '0',
              token1Address: '0x0000000000000000000000000000000000000000',
              token1Price: '0',
              token1PriceLower: '0',
              token1PriceUpper: '0',
            },
        new Date(),
      );
    }
  }

  const automate = await container.model
    .automateContractTable()
    .where('contractWallet', wallet.id)
    .first();
  if (!automate) {
    throw new Error('Automate not found');
  }

  const isNewRebalance = await container
    .cache()
    .promises.get(`defihelper:uni3-rebalance:${automate.id}`)
    .then((v) => v === '1');
  if (isNewRebalance && positions.length > 0) {
    await Promise.all([
      container.model.queueService().push('notificationUni3Rebalance', {
        id: wallet.id,
        position: positions[0],
      }),
      container.cache().promises.del(`defihelper:uni3-rebalance:${automate.id}`),
    ]);
  }

  const notRewardedPositions = positions.filter(
    ({ token0 }) =>
      new BN(token0.price.value).lt(token0.price.lower) ||
      new BN(token0.price.value).gt(token0.price.upper),
  );
  if (notRewardedPositions.length === 0) {
    return process.done();
  }

  const isNotificationLocked = await container
    .cache()
    .promises.get(`defihelper:uni3-notification:positionsWithoutReward:${wallet.id}`);
  if (!isNotificationLocked) {
    await container.model.queueService().push('notificationUni3OutOfPriceRange', {
      id: wallet.id,
      position: notRewardedPositions[0],
    });
  }

  const rebalance = await container.model
    .automateContractRebalanceTable()
    .where('contract', automate.id)
    .first();
  if (rebalance) {
    await container.model.queueService().push('automateUni3Rebalance', {
      id: automate.id,
    });
  }

  return process.done();
};
