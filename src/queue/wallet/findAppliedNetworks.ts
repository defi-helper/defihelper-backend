import container from '@container';
import { Process } from '@models/Queue/Entity';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

export interface Params {
  walletId: string;
}

export default async (process: Process) => {
  const { walletId } = process.task.params as Params;
  const inheritWallet = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where(`${walletTableName}.id`, walletId)
    .first();
  if (!inheritWallet) throw new Error('Wallet is not found');

  if (inheritWallet.blockchain !== 'ethereum') {
    return process.done();
  }

  const walletOwner = await container.model.userTable().where('id', inheritWallet.user).first();
  if (!walletOwner) throw new Error('Wallet owner is not found');

  const existingWallets = await container.model
    .walletTable()
    .innerJoin(
      walletBlockchainTableName,
      `${walletBlockchainTableName}.id`,
      `${walletTableName}.id`,
    )
    .where('user', inheritWallet.user);
  const assetsList = await container.debank().getTokensOnWallet(inheritWallet.address);
  const chainsList = [...new Set(assetsList.map((v) => v.chain))];

  await Promise.all(
    chainsList.map(async (namedChain) => {
      const numberedNetwork = container.debank().chainResolver(namedChain as string);
      if (!numberedNetwork) {
        return;
      }

      const existing = existingWallets.some(
        (w) =>
          w.network === numberedNetwork.numbered &&
          w.blockchain === inheritWallet.blockchain &&
          w.address.toLowerCase() === inheritWallet.address.toLowerCase(),
      );

      if (existing || numberedNetwork.numbered === null) {
        return;
      }

      await container.model
        .walletService()
        .createBlockchainWallet(
          walletOwner,
          inheritWallet.blockchain,
          numberedNetwork.numbered,
          WalletBlockchainType.Wallet,
          inheritWallet.address,
          inheritWallet.publicKey,
          '',
        );
    }),
  );

  return process.done();
};
