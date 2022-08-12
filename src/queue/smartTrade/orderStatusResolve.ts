import container from '@container';
import { Process } from '@models/Queue/Entity';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { abi as RouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
import { OrderStatus, orderStatusResolve } from '@models/SmartTrade/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }
  if (order.blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  if (!isKey(contracts, order.network)) {
    throw new Error('Contracts not deployed to target network');
  }
  if ([OrderStatus.Succeeded, OrderStatus.Canceled].includes(order.status)) {
    return process.done();
  }

  const networkContracts = contracts[order.network] as { [name: string]: { address: string } };
  const router = container.blockchain[order.blockchain].contract(
    networkContracts.SmartTradeRouter.address,
    RouterABI,
    container.blockchain[order.blockchain].byNetwork(order.network).provider(),
  );

  const currentStatus = orderStatusResolve(
    await router
      .order(order.number)
      .then(({ status }: { status: ethers.BigNumber }) => status.toString()),
  );
  if (currentStatus === OrderStatus.Pending) {
    return process.later(dayjs().add(5, 'minutes').toDate());
  }

  await container.model.smartTradeService().updateOrder({
    ...order,
    status: currentStatus,
  });

  return process.done();
};
