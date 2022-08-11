import container from '@container';
import { Process } from '@models/Queue/Entity';
import { OrderCallStatus } from '@models/SmartTrade/Entity';

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

  const smartTradeService = container.model.smartTradeService();
  const provider = container.blockchain.ethereum.byNetwork(order.network).provider();
  try {
    const receipt = await provider.waitForTransaction(call.tx, 1, 30);
    if (receipt.status === 1) {
      await smartTradeService.updateCall({
        ...call,
        status: OrderCallStatus.Succeeded,
      });
    } else if (receipt.status === 0) {
      await smartTradeService.updateCall({
        ...call,
        status: OrderCallStatus.Error,
        error: 'revert',
      });
    }
  } catch (e) {
    await smartTradeService.updateCall({
      ...call,
      status: OrderCallStatus.Error,
      error: `${e}`,
    });
  }

  return process.done();
};
