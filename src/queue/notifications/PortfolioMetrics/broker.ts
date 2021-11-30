import { Process } from '@models/Queue/Entity';
import container from '@container';
import { userContactTableName } from '@models/Notification/Entity';
import { Role, tableName as userTableName } from '@models/User/Entity';
import dayjs from 'dayjs';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';

export default async (process: Process) => {
  const users = await container.model
    .userTable()
    .distinct(`${userTableName}.*`)
    .innerJoin(userContactTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .innerJoin(
      userNotificationTableName,
      `${userTableName}.id`,
      `${userNotificationTableName}.user`,
    )
    .where(`${userNotificationTableName}.type`, UserNotificationType.PortfolioMetrics)
    .andWhereNot(`${userTableName}.role`, Role.Candidate);

  const lag = 86400 / users.length; // seconds in day
  await users.reduce<Promise<dayjs.Dayjs>>(async (prev, user) => {
    const startAt = await prev;
    await container.model.queueService().push('notificationPortfolioMetricsNotify', {
      userId: user.id,
    });
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
