import { Process } from '@models/Queue/Entity';
import container from '@container';
import { triggerTableName } from '@models/Automate/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import { transferTableName } from '@models/Billing/Entity';

export default async (process: Process) => {
  const { userId } = process.task.params as { userId: string };

  const user = await container.model.userTable().where({ id: userId }).first();
  if (!user) {
    throw new Error('User not found');
  }

  const database = container.database();
  const triggers = await container.model
    .automateTriggerTable()
    .columns(
      `${walletTableName}.id as walletId`,
      `${walletTableName}.network as walletNetwork`,
      `${triggerTableName}.id as triggerId`,
    )
    .innerJoin(walletTableName, `${triggerTableName}.wallet`, `${walletTableName}.id`)
    .where('active', true)
    .andWhere(`${walletTableName}.user`, user.id);

  const walletsFunds = await container.model
    .billingTransferTable()
    .column(`${walletTableName}.id as id`)
    .column(database.raw('coalesce(sum(amount), 0) as funds'))
    .innerJoin(walletTableName, `${walletTableName}.address`, `${transferTableName}.account`)
    .whereIn(
      `${walletTableName}.id`,
      triggers.map((t) => t.walletId),
    )
    .andWhere(`${transferTableName}.network`, `${walletTableName}.network`)
    .andWhere(`${transferTableName}.blockchain`, `${walletTableName}.blockchain`)
    .groupBy(`${walletTableName}.id`);

  // promise all send notifications
  await Promise.all(
    triggers.map((t: { walletId: string; triggerId: string; walletNetwork: string }) => {
      let walletFunds = walletsFunds.find((w) => w.id === t.walletId);

      if (!walletFunds) {
        walletFunds = { id: t.walletId, funds: 0 };
      }

      // check wallet chain and select minimum transaction price

      let automateCallMinimumRequiredBalance = 0;
      switch (t.walletNetwork) {
        case '1':
          // MoralisRestAPIChain.eth;
          automateCallMinimumRequiredBalance = 1;
          break;
        case '56':
          // MoralisRestAPIChain.bsc;
          automateCallMinimumRequiredBalance = 1;
          break;
        case '137':
          // MoralisRestAPIChain.polygon;
          automateCallMinimumRequiredBalance = 1;
          break;
        case '43114':
          // MoralisRestAPIChain.avalanche;
          automateCallMinimumRequiredBalance = 1;
          break;
        default:
          throw new Error('unsupported network');
      }

      if (walletFunds.funds < automateCallMinimumRequiredBalance) {
        // send notification
      }

      return null;
    }),
  );

  return process.done();
};
