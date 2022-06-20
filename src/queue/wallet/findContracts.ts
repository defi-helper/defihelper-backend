import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  walletId: string;
}

export default async (process: Process) => {
  const { walletId } = process.task.params as Params;
  const blockchainWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();
  if (!blockchainWallet) throw new Error('Wallet is not found');

  if (blockchainWallet.blockchain !== 'ethereum') {
    return process.done();
  }

  const contractsAddresses = await container
    .watcher()
    .getContractsAddressByUserAddress(blockchainWallet.network, blockchainWallet.address);

  const groupLimit = 50;
  const grouped = contractsAddresses.reduce<string[][]>((groups, address) => {
    if (groups.length === 0) {
      groups.push([]);
    }

    const normalizedAddress =
      blockchainWallet.blockchain === 'ethereum' ? address.toLowerCase() : address;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup.length < groupLimit) {
      lastGroup.push(normalizedAddress);
    } else {
      groups.push([normalizedAddress]);
    }

    return groups;
  }, []);

  // Because of iterators/generators restrictions and no-await-in-loop
  let chainablePromise = Promise.resolve();
  grouped.forEach((group) => {
    chainablePromise = chainablePromise.then(() => {
      return container.model
        .contractTable()
        .innerJoin(
          contractBlockchainTableName,
          `${contractBlockchainTableName}.id`,
          `${contractTableName}.id`,
        )
        .andWhere('blockchain', blockchainWallet.blockchain)
        .andWhere('network', blockchainWallet.network)
        .whereIn('address', group)
        .then((contracts) => {
          contracts.reduce((chainableContractsPromise, contract) => {
            return chainableContractsPromise.then(async () => {
              await container.model.contractService().walletLink(contract, blockchainWallet);
            });
          }, Promise.resolve());
        });
    });
  });

  await chainablePromise;

  return process.done();
};
