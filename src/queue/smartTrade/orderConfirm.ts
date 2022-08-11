import container from '@container';
import { Process } from '@models/Queue/Entity';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { abi as RouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';

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

  const networkContracts = contracts[order.network] as { [name: string]: { address: string } };
  const router = container.blockchain.ethereum.contract(
    networkContracts.SmartTradeRouter.address,
    RouterABI,
    container.blockchain.ethereum.byNetwork(order.network).provider(),
  );
  const orderOwner = await router.order(order.number).then(({ owner }: { owner: string }) => owner);
  if (orderOwner.toLowerCase() !== order.owner.toLowerCase()) {
    throw new Error(`Invalid order owner or order not found: "${order.id}"`);
  }

  await container.model.smartTradeService().confirm(order);

  return process.done();
};
