import container from '@container';
import dayjs from 'dayjs';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import { isKey } from '@services/types';
import { ethers } from 'ethers';
import { abi as storeAbi } from '@defihelper/networks/abi/StoreV2.json';
import contracts from '@defihelper/networks/contracts.json';

async function registerBuy(blockchain: Blockchain, network: string, events: ethers.Event[]) {
  const duplicates = await container.model
    .storePurchaseTable()
    .column('tx')
    .where(function () {
      this.where({ blockchain, network }).whereIn(
        'tx',
        events.map(({ transactionHash }) => transactionHash),
      );
    });
  const duplicatesTx = duplicates.map(({ tx }) => tx);
  const storeService = container.model.storeService();
  return Promise.all(
    events.map(async ({ getBlock, transactionHash, args }) => {
      if (args === undefined || duplicatesTx.includes(transactionHash)) return null;
      const { timestamp } = await getBlock();

      const product = await storeService.productTable().where('number', args.product).first();
      if (!product) return null;

      return storeService.purchase(
        product,
        blockchain,
        network,
        args.recipient.toLowerCase(),
        product.amount,
        transactionHash,
        dayjs.unix(timestamp).toDate(),
      );
    }),
  );
}

export interface Params {
  blockchain: Blockchain;
  network: string;
  from: number;
  step: number;
  lag?: number;
}

export default async (process: Process) => {
  const { blockchain, network, from, step, lag = 0 } = process.task.params as Params;
  if (blockchain !== 'ethereum') {
    throw new Error('Invalid blockchain');
  }
  if (!isKey(contracts, network)) {
    throw new Error('Contracts not deployed to target network');
  }

  const later = dayjs().add(1, 'minute').toDate();
  const provider = container.blockchain[blockchain].byNetwork(network).provider();
  const currentBlockNumber = parseInt((await provider.getBlockNumber()).toString(), 10) - lag;
  if (currentBlockNumber < from) {
    return process.later(later);
  }
  const to = from + step > currentBlockNumber ? currentBlockNumber : from + step;

  const storeAddress = contracts[network].StoreUpgradable.address;
  const store = container.blockchain[blockchain].contract(storeAddress, storeAbi, provider);

  await registerBuy(blockchain, network, await store.queryFilter(store.filters.Buy(), from, to));

  return process.param({ ...process.task.params, from: to + 1 }).later(later);
};
