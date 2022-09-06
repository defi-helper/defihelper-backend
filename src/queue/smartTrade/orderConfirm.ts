import container from '@container';
import { Process } from '@models/Queue/Entity';
import { isKey } from '@services/types';
import contracts from '@defihelper/networks/contracts.json';
import { abi as RouterABI } from '@defihelper/networks/abi/SmartTradeRouter.json';
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
  const router = container.blockchain.ethereum.contract(
    networkContracts.SmartTradeRouter.address,
    RouterABI,
    container.blockchain.ethereum.byNetwork(ownerWallet.network).provider(),
  );
  const orderOwner = await router.order(order.number).then(({ owner }: { owner: string }) => owner);
  if (orderOwner.toLowerCase() !== ownerWallet.address.toLowerCase()) {
    throw new Error(`Invalid order owner or order not found: "${order.id}"`);
  }

  await container.model.smartTradeService().confirm(order);

  return process.done();
};
