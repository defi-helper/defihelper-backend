import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { tableName as userTableName, User } from '@models/User/Entity';
import { userNotificationTableName, UserNotification } from '@models/UserNotification/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const notifications = (await container.model
    .userNotificationTable()
    .innerJoin(userTableName, `${userNotificationTableName}.id`, `${userTableName}.id`)
    .where({
      broker: ContactBroker.Telegram,
      status: ContactStatus.Active,
    })) as (UserNotification & User)[];

  await Promise.all(
    notifications.map((notification) => {
      const [userPrefferredHour] = notification.time.split(':');
      const currentHourInUserPrefferedTimezone = dayjs()
        .tz(notification.timezone)
        .set('minute', 0)
        .set('second', 0)
        .get('hour');

      if (Number(userPrefferredHour) !== currentHourInUserPrefferedTimezone) {
        return null;
      }

      return container.model.queueService().push('notificationPortfolioMetricsNotify', {
        notificationId: notification.id,
      });
    }),
  );

  return process.done();
};
