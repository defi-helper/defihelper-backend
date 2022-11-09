import { Process } from '@models/Queue/Entity';
import container from '@container';
import { tableName as userTableName } from '@models/User/Entity';
import dayjs from 'dayjs';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';
import { triggerTableName } from '@models/Automate/Entity';
import { userContactTableName } from '@models/Notification/Entity';

export default async (process: Process) => {
  const database = container.database();

  const users = await container.model
    .userTable()
    .column(`${userTableName}.id`)
    .distinct(`${userTableName}.id`)
    .innerJoin(walletTableName, `${userTableName}.id`, `${walletTableName}.user`)
    .innerJoin(
      walletBlockchainTableName,
      `${walletTableName}.id`,
      `${walletBlockchainTableName}.id`,
    )
    .innerJoin(triggerTableName, `${walletTableName}.id`, `${triggerTableName}.wallet`)
    .innerJoin(userContactTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .innerJoin(
      userNotificationTableName,
      `${userContactTableName}.id`,
      `${userNotificationTableName}.contact`,
    )
    .where(`${triggerTableName}.active`, true)
    .whereNull(`${walletTableName}.deletedAt`)
    .andWhere(`${walletBlockchainTableName}.blockchain`, 'ethereum')
    .having(database.raw(`count(distinct ${triggerTableName}.id) > 0`))
    .andWhere(`${userNotificationTableName}.type`, UserNotificationType.AutomateCallNotEnoughFunds)
    .groupBy(`${userTableName}.id`);

  const lag = 86400 / users.length; // seconds in day
  await users.reduce<Promise<dayjs.Dayjs>>(async (prev, user) => {
    const startAt = await prev;
    await container.model.queueService().push(
      'notificationAutomateWalletsNotEnoughFundsNotify',
      {
        userId: user.id,
      },
      { startAt: startAt.toDate() },
    );
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
