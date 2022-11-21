import container from '@container';
import { Process } from '@models/Queue/Entity';
import { OrderCallStatus, OrderStatus } from '@models/SmartTrade/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import dayjs from 'dayjs';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const call = await container.model.smartTradeOrderCallHistoryTable().where('id', id).first();
  if (!call) {
    throw new Error(`Order call "${id}" not found`);
  }
  if (call.tx === null) {
    throw new Error(`Transaction not found in call "${call.id}"`);
  }
  if (call.status !== OrderCallStatus.Pending) {
    return process.done();
  }
  const order = await container.model.smartTradeOrderTable().where('id', call.order).first();
  if (!order) {
    throw new Error(`Order "${call.order}" not found`);
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

  const smartTradeService = container.model.smartTradeService();
  const provider = container.blockchain.ethereum.byNetwork(ownerWallet.network).provider();
  try {
    const receipt = await provider.waitForTransaction(call.tx, 1, 10000);
    if (receipt.status === 1) {
      await Promise.all([
        smartTradeService.updateCall({
          ...call,
          status: OrderCallStatus.Succeeded,
        }),
        smartTradeService.updateOrder({
          ...order,
          status: OrderStatus.Succeeded,
        }),
      ]);
    } else if (receipt.status === 0) {
      await smartTradeService.updateCall({
        ...call,
        status: OrderCallStatus.Error,
        error: 'revert',
      });
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('timeout exceeded')) {
      return process.later(dayjs().add(10, 'seconds').toDate());
    }
    await smartTradeService.updateCall({
      ...call,
      status: OrderCallStatus.Error,
      error: `${e}`,
    });
  }

  return process.done();
};
