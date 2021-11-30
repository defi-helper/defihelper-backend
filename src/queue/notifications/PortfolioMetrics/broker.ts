import { Process } from '@models/Queue/Entity';
import container from '@container';
import { userContactTableName } from '@models/Notification/Entity';
import { Role, tableName as userTableName, User } from '@models/User/Entity';
import dayjs from 'dayjs';
import { UserNotificationType } from '@models/UserNotification/Entity';

export default async (process: Process) => {
  const users = await container.model
    .userTable()
    .distinct(`${userTableName}.*`)
    .innerJoin(userContactTableName, `${userTableName}.id`, `${userContactTableName}.user`)
    .whereNot(`${userTableName}.role`, Role.Candidate);

  const shouldBeSend = async (user: User) => {
    const v = await container.model
      .userNotificationService()
      .isNotificationEnabled(user, UserNotificationType.PortfolioMetrics);
    return v;
  };

  const lag = 86400 / users.length; // seconds in day
  await users
    .filter((user) => shouldBeSend(user))
    .reduce<Promise<dayjs.Dayjs>>(async (prev, user) => {
      const startAt = await prev;
      await container.model.queueService().push('notificationPortfolioMetricsNotify', {
        userId: user.id,
      });
      return startAt.clone().add(lag, 'seconds');
    }, Promise.resolve(dayjs()));

  return process.done();
};
