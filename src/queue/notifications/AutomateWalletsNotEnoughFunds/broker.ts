import { Process } from '@models/Queue/Entity';
import container from '@container';
import { userContactTableName } from '@models/Notification/Entity';
import { Role, tableName as userTableName } from '@models/User/Entity';
import dayjs from 'dayjs';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import { triggerTableName } from '@models/Automate/Entity';

export default async (process: Process) => {
  const users = await container.model
    .userTable()
    .column(`${userTableName}.id`)
    .distinct(`${userTableName}.id`)
    .innerJoin(userContactTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .innerJoin(walletTableName, `${userTableName}.id`, `${walletTableName}.user`)
    .innerJoin(triggerTableName, `${walletTableName}.id`, `${triggerTableName}.wallet`)
    .where(`${triggerTableName}.active`, true)
    .andWhere(`${walletTableName}.blockchain`, 'ethereum')
    .having(`count(distinct ${triggerTableName}.id)`, '>', 0)
    .andWhere(`${userNotificationTableName}.type`, UserNotificationType.AutomateCallNotEnoughFunds)
    .andWhereNot(`${userTableName}.role`, Role.Candidate);

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
