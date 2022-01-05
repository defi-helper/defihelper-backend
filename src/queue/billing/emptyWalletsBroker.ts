import { Process } from '@models/Queue/Entity';
import container from '@container';
import { transferTableName } from '@models/Billing/Entity';
import { tableName as walletTableName, WalletType } from '@models/Wallet/Entity';
import BN from 'bignumber.js';

export default async (process: Process) => {
  const database = container.database();

  const amounts = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id as walletId`)
    .column(`${walletTableName}.user as userId`)
    .column(`${walletTableName}.network as walletNetwork`)
    .column(database.raw('coalesce(sum(amount), 0) as funds'))
    .innerJoin(walletTableName, `${walletTableName}.address`, `${transferTableName}.account`)
    .andWhere(`${transferTableName}.network`, database.raw(`${walletTableName}.network`))
    .andWhere(`${transferTableName}.blockchain`, database.raw(`${walletTableName}.blockchain`))
    .andWhere(`${walletTableName}.type`, WalletType.Wallet)
    .groupBy(`${walletTableName}.id`);

  await Promise.all(
    amounts.map(async (v) => {
      const chainNativeUSD = new BN(
        await container.blockchain.ethereum.byNetwork(v.walletNetwork).nativeTokenPrice(),
      ).toNumber();

      if (v.funds * chainNativeUSD - (1 + chainNativeUSD * 0.1) > 0) {
        return container.model.walletService().lowFunds(v.walletId, false);
      }

      return container.model.walletService().lowFunds(v.walletId, true);
    }),
  );

  return process.done();
};
