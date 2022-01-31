import container from '@container';
import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import {
  walletBlockchainTableName,
  walletTableName,
  WalletBlockchainType,
} from '@models/Wallet/Entity';

export interface Params {
  walletId: string;
}

interface Asset {
  chain: string;
  amount: number;
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
  const assetsList: Asset[] = (
    await axios.get(
      `https://openapi.debank.com/v1/user/token_list?id=${inheritWallet.address}&is_all=true`,
    )
  ).data;

  const chainsList = [...new Set(assetsList.map((v) => v.chain))];

  await Promise.all(
    chainsList
      .map((debankChain) => {
        switch (debankChain) {
          case 'bsc':
            return '56';

          case 'eth':
            return '1';

          case 'matic':
            return '137';

          case 'avax':
            return '43114';

          case 'movr':
            return '1285';

          default:
            return null;
        }
      })
      .map(async (network) => {
        const existing = existingWallets.some(
          (w) => w.network === network && w.blockchain === 'ethereum',
        );

        if (existing || network === null) {
          return;
        }

        await container.model
          .walletService()
          .createBlockchainWallet(
            walletOwner,
            inheritWallet.blockchain,
            network,
            WalletBlockchainType.Wallet,
            inheritWallet.address,
            inheritWallet.publicKey,
            '',
          );
      }),
  );

  return process.done();
};
