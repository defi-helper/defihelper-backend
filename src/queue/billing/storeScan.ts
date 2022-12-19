import container from '@container';
import { Process } from '@models/Queue/Entity';
import { abi as storeAbi } from '@defihelper/networks/abi/StoreV3.json';

export interface Params {
  network: string;
}

export default async (process: Process) => {
  const { network } = process.task.params as Params;

  const blockchainContainer = container.blockchain.ethereum;
  const networkContainer = blockchainContainer.byNetwork(network);
  const contracts = networkContainer.dfhContracts();
  if (contracts === null) {
    throw new Error('Contracts not deployed to target network');
  }
  const storeAddress = contracts.StoreUpgradable?.address;
  if (storeAddress === undefined) {
    throw new Error('Store contract not deployed on this network');
  }
  const provider = networkContainer.provider();
  const store = blockchainContainer.contract(storeAddress, storeAbi, provider);

  const lastPurchaseNumber = await container.model
    .storePurchaseTable()
    .where('blockchain', 'ethereum')
    .where('network', network)
    .orderBy('number', 'desc')
    .first()
    .then((row) => Number(row?.number ?? 0));

  const storeService = container.model.storeService();
  try {
    const newPurchase = await store.purchases(lastPurchaseNumber + 1);
    if (newPurchase.recipient === '0x0000000000000000000000000000000000000000') {
      return process.laterAt(1, 'minutes');
    }

    const product = await storeService
      .productTable()
      .where('number', newPurchase.product.toString())
      .first();
    if (!product) {
      return process.laterAt(1, 'minutes');
    }

    await storeService.purchase(
      product,
      'ethereum',
      network,
      Number(newPurchase.id.toString()),
      newPurchase.recipient.toLowerCase(),
      product.amount,
      '',
      new Date(),
    );
  } catch (e) {
    return process.laterAt(1, 'minutes').info(`${e}`);
  }

  return process.later(new Date());
};
