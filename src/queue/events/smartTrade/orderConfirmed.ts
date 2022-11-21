import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType, Order, OrderStatus } from '@models/SmartTrade/Entity';
import UniswapPairABI from '@models/SmartTrade/data/uniswapPairABI.json';
import {
  Wallet,
  WalletBlockchain,
  walletBlockchainTableName,
  walletTableName,
} from '@models/Wallet/Entity';
import { LogJsonMessage } from '@services/Log';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const log = LogJsonMessage.debug({ source: 'smartTradeOrderConfirmed', orderId: id });

  async function registerWatcher(order: Order, ownerWallet: Wallet & WalletBlockchain) {
    if (order.status !== OrderStatus.Pending) return null;

    if (order.type === HandlerType.SwapHandler) {
      const scanner = container.scanner();
      const listener = await scanner.registerListener(
        await scanner.registerContract(ownerWallet.network, order.callData.pair, UniswapPairABI),
        'Sync',
        { promptly: {} },
      );
      log.ex({ listenerId: listener.id }).send();

      return container.model
        .smartTradeOrderTable()
        .update({ watcherListenerId: listener.id, updatedAt: new Date() })
        .where('id', order.id);
    }

    return null;
  }

  const queue = container.model.queueService();
  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }
  const ownerWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .where(`${walletTableName}.id`, order.owner)
    .first();
  if (!ownerWallet) {
    throw new Error('Owner wallet not found');
  }

  await container.model.queueService().push('smartTradeBalancesFiller', { id: order.id });
  if (order.statusTask === null) {
    const statusTask = await queue
      .push('smartTradeOrderStatusResolve', { id: order.id })
      .then((task) => task.id);
    log.ex({ statusTask }).send();
    await container.model
      .smartTradeOrderTable()
      .update({ statusTask, updatedAt: new Date() })
      .where('id', order.id);
  }
  if (order.watcherListenerId === null) {
    await registerWatcher(order, ownerWallet);
  }

  return process.done();
};
