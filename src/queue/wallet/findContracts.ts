import container from '@container';
import { Process } from '@models/Queue/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

export interface Params {
  walletId: string;
}

export default async (process: Process) => {
  const { walletId } = process.task.params as Params;
  const wallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where('id', walletId)
    .first();
  if (!wallet) throw new Error('Wallet is not found');

  if (wallet.blockchain !== 'ethereum') {
    return process.done();
  }

  const contractsAddresses = await container
    .scanner()
    .getContractsAddressByUserAddress(wallet.network, wallet.address);

  const groupLimit = 50;
  const grouped = contractsAddresses.reduce<string[][]>((groups, address) => {
    if (groups.length === 0) {
      groups.push([]);
    }

    const lastGroup = groups[groups.length - 1];
    if (lastGroup.length < groupLimit) {
      lastGroup.push(address);
    } else {
      groups.push([address]);
    }

    return groups;
  }, []);

  // Because of iterators/generators restrictions and no-await-in-loop
  let chainablePromise = Promise.resolve();
  grouped.forEach((group) => {
    chainablePromise = chainablePromise.then(() => {
      return container.model
        .contractTable()
        .whereIn('address', group)
        .then((contracts) => {
          contracts.reduce((chainableContractsPromise, contract) => {
            return chainableContractsPromise.then(async () => {
              await container.model.contractService().walletLink(contract, wallet);
            });
          }, Promise.resolve());
        });
    });
  });

  await chainablePromise;

  return process.done();
};
