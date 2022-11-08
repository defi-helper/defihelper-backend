import container from '@container';
import { Process } from '@models/Queue/Entity';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { abi as RouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
import { OrderStatus, orderStatusResolve } from '@models/SmartTrade/Entity';
import dayjs from 'dayjs';
import { ethers } from 'ethers';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;

  const order = await container.model.smartTradeOrderTable().where('id', id).first();
  if (!order) {
    throw new Error(`Order "${id}" not found`);
  }
  if ([OrderStatus.Succeeded, OrderStatus.Canceled].includes(order.status)) {
    return process.done();
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
  if (ownerWallet.blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }

  if (!isKey(contracts, ownerWallet.network)) {
    throw new Error('Contracts not deployed to target network');
  }
  const networkContracts = contracts[ownerWallet.network] as {
    [name: string]: { address: string };
  };
  const router = container.blockchain[ownerWallet.blockchain].contract(
    networkContracts.SmartTradeRouter.address,
    RouterABI,
    container.blockchain[ownerWallet.blockchain].byNetwork(ownerWallet.network).provider(),
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
    claim: currentStatus === OrderStatus.Canceled ? true : order.claim,
  });

  return process.done();
};
