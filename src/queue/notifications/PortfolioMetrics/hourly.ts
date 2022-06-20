import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus, userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName, User } from '@models/User/Entity';
import { userNotificationTableName, UserNotification } from '@models/UserNotification/Entity';

export default async (process: Process) => {
  const notifications = (await container.model
    .userNotificationTable()
    .innerJoin(
      userContactTableName,
      `${userNotificationTableName}.contact`,
      `${userContactTableName}.id`,
    )
    .innerJoin(userTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .where({
      broker: ContactBroker.Telegram,
      status: ContactStatus.Active,
    })
    .andWhereRaw(
      `to_char(NOW() AT TIME ZONE user.timezone,'HH24') = to_char(${userNotificationTableName}.time,'HH24')`,
    )) as (UserNotification & User)[];

  await Promise.all(
    notifications.map((notification) =>
      container.model.queueService().push('notificationPortfolioMetricsNotify', {
        notificationId: notification.id,
      }),
    ),
  );

  return process.done();
};
