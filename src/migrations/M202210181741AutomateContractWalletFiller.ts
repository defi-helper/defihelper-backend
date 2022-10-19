import { walletBlockchainTableName, WalletBlockchainType } from '@models/Wallet/Entity';
import { contractTableName } from '@models/Automate/Entity';
import container from '@container';

export default async () => {
  const automates = await container.model
    .automateContractTable()
    .column({ id: `${contractTableName}.id` })
    .column({ blockchain: `${walletBlockchainTableName}.blockchain` })
    .column({ network: `${walletBlockchainTableName}.network` })
    .column({ address: `${contractTableName}.address` })
    .innerJoin(
      walletBlockchainTableName,
      `${contractTableName}.wallet`,
      `${walletBlockchainTableName}.id`,
    )
    .whereNull('contractWallet');

  const walletsMap = await container.model
    .walletBlockchainTable()
    .where('type', WalletBlockchainType.Contract)
    .then(
      (rows) =>
        new Map(
          rows.map((wallet) => [
            `${wallet.blockchain}:${wallet.network}:${wallet.address.toLowerCase()}`,
            wallet.id,
          ]),
        ),
    );

  await automates.reduce<Promise<unknown>>(async (prev, automate) => {
    await prev;

    const { blockchain, network, address, id } = automate as {
      blockchain: string;
      network: string;
      address: string;
      id: string;
    };
    const walletId = walletsMap.get(`${blockchain}:${network}:${address.toLowerCase()}`);
    if (!walletId) return null;

    return container.model
      .automateContractTable()
      .update({ contractWallet: walletId })
      .where('id', id);
  }, Promise.resolve(null));
};
