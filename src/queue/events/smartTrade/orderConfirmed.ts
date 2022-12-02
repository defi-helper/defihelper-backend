import container from '@container';
import { Process } from '@models/Queue/Entity';
import { HandlerType } from '@models/SmartTrade/Entity';
import UniswapPairABI from '@models/SmartTrade/data/uniswapPairABI.json';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { LogJsonMessage } from '@services/Log';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const log = LogJsonMessage.debug({ source: 'smartTradeOrderConfirmed', orderId: id });

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

  await Promise.all([
    container.model.queueService().push('smartTradeOrderCreatedNotify', { id: order.id }),
    container.model.queueService().push('smartTradeBalancesFiller', { id: order.id }),
    (async () => {
      if (order.watcherListenerId !== null) return null;

      if (order.type === HandlerType.SwapHandler) {
        const scanner = container.scanner();
        const listener = await scanner.registerListener(
          await scanner.registerContract(ownerWallet.network, order.callData.pair, UniswapPairABI),
          'Sync',
          { promptly: {} },
        );
        log.ex({ listenerId: listener.id }).send();

        return container.model
          .smartTradeService()
          .updateOrder(order, { watcherListenerId: listener.id });
      }
      return null;
    })(),
  ]);

  return process.done();
};
