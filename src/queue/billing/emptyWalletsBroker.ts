import { Process } from '@models/Queue/Entity';
import container from '@container';
import { transferTableName } from '@models/Billing/Entity';
import {
  tableName as walletTableName,
  WalletSuspenseReason,
  WalletType,
} from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import { triggerTableName } from '@models/Automate/Entity';

export default async (process: Process) => {
  const database = container.database();

  const amounts = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id as walletId`)
    .column(`${walletTableName}.user as userId`)
    .column(`${walletTableName}.network as walletNetwork`)
    .column(database.raw('greatest(0, sum(amount)) as funds'))
    .innerJoin(walletTableName, `${walletTableName}.address`, `${transferTableName}.account`)
    .innerJoin(triggerTableName, `${triggerTableName}.wallet`, `${walletTableName}.id`)
    .andWhere(`${transferTableName}.network`, database.raw(`${walletTableName}.network`))
    .andWhere(`${transferTableName}.blockchain`, database.raw(`${walletTableName}.blockchain`))
    .andWhere(`${walletTableName}.type`, WalletType.Wallet)
    .groupBy(`${walletTableName}.id`);

  await Promise.all(
    amounts.map(async (v) => {
      const chainNativeUSD = new BN(
        await container.blockchain.ethereum.byNetwork(v.walletNetwork).nativeTokenPrice(),
      ).toNumber();

      if (v.funds * chainNativeUSD > 3) {
        return container.model.walletService().suspense(v.walletId, null);
      }

      return container.model.walletService().suspense(v.walletId, WalletSuspenseReason.LowFunds);
    }),
  );

  return process.done();
};
