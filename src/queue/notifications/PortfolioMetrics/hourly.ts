import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactStatus, userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';

export default async (process: Process) => {
  const notifications = await container.model
    .userNotificationTable()
    .select(`${userNotificationTableName}.id as notificationId`)
    .innerJoin(
      userContactTableName,
      `${userNotificationTableName}.contact`,
      `${userContactTableName}.id`,
    )
    .innerJoin(userTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .where({
      status: ContactStatus.Active,
      type: UserNotificationType.PortfolioMetrics,
    })
    .andWhereRaw(
      `to_char(NOW() AT TIME ZONE "${userTableName}".timezone,'HH24') = to_char("${userNotificationTableName}".time,'HH24')`,
    );

  await Promise.all(
    notifications.map(({ notificationId }) =>
      container.model.queueService().push('notificationPortfolioMetricsNotify', {
        notificationId,
      }),
    ),
  );

  return process.done();
};
