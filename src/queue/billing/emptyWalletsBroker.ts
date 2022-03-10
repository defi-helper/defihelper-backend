import { Process } from '@models/Queue/Entity';
import container from '@container';
import { transferTableName } from '@models/Billing/Entity';
import {
  walletTableName,
  WalletSuspenseReason,
  WalletBlockchainType,
  walletBlockchainTableName,
} from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import { triggerTableName } from '@models/Automate/Entity';

export default async (process: Process) => {
  const database = container.database();

  const amounts = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id as walletId`)
    .column(`${walletTableName}.user as userId`)
    .column(`${walletBlockchainTableName}.network as walletNetwork`)
    .column(database.raw('greatest(0, sum(amount)) as funds'))
    .innerJoin(walletBlockchainTableName, function () {
      this.on(`${walletBlockchainTableName}.blockchain`, '=', `${transferTableName}.blockchain`)
        .andOn(`${walletBlockchainTableName}.network`, '=', `${transferTableName}.network`)
        .andOn(`${walletBlockchainTableName}.address`, '=', `${transferTableName}.account`);
    })
    .innerJoin(walletTableName, `${walletBlockchainTableName}.id`, `${walletTableName}.id`)
    .innerJoin(triggerTableName, `${triggerTableName}.wallet`, `${walletTableName}.id`)
    .andWhere(`${walletBlockchainTableName}.type`, WalletBlockchainType.Wallet)
    .groupBy(`${walletTableName}.id`, `${walletBlockchainTableName}.network`);

  await Promise.all(
    amounts.map(async (v) => {
      const chainNativeUSD = new BN(
        await container.blockchain.ethereum.byNetwork(v.walletNetwork).nativeTokenPrice(),
      ).toNumber();

      if (v.funds * chainNativeUSD - (1 + chainNativeUSD * 0.1) > 0) {
        return container.model.walletService().suspense(v.walletId, null);
      }

      return container.model.walletService().suspense(v.walletId, WalletSuspenseReason.LowFunds);
    }),
  );

  return process.done();
};
