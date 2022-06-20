import container from '@container';
import { Process } from '@models/Queue/Entity';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';
import { WalletBlockchainType } from '@models/Wallet/Entity';

export interface Params {
  wallets: string[];
}

export default async (process: Process) => {
  const { wallets } = process.task.params as Params;

  const contractsAddressesByWallets = await container
    .watcher()
    .getWalletsInteractedContracts(wallets);

  const localWallets = await container.model
    .walletBlockchainTable()
    .whereIn('address', wallets)
    .andWhere('type', WalletBlockchainType.Wallet);

  const localContracts = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .whereIn(
      `${contractBlockchainTableName}.address`,
      Object.values(contractsAddressesByWallets)
        .map((v) => Object.values(v))
        .flat(2),
    );

  const linked: string[] = [];
  await Promise.all(
    Object.entries(contractsAddressesByWallets).map(([wallet, networks]) =>
      Promise.all(
        Object.entries(networks).map(([network, contracts]) =>
          Promise.all(
            contracts.map((contract) => {
              const localWallet = localWallets.find(
                (v) => v.network === network && v.address === wallet,
              );
              const localContract = localContracts.find(
                (v) => v.address === contract && v.network === network,
              );

              if (!localContract || !localWallet) return null;

              linked.push(localWallet.id);
              return container.model.contractService().walletLink(localContract, localWallet);
            }),
          ),
        ),
      ),
    ),
  );

  return process.done().info(`linked: ${linked.join(',')}`);
};
