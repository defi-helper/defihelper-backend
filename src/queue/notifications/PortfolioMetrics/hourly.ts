import { Process } from '@models/Queue/Entity';
import container from '@container';
import {
  ContactStatus,
  notificationTableName,
  userContactTableName,
} from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import { userNotificationTableName, UserNotificationType } from '@models/UserNotification/Entity';
import { walletTableName } from '@models/Wallet/Entity';
import { Query as StoreQuery } from '@models/Store/Service';
import { Query as NotificationQuery } from '@models/Notification/Service';

export default async (process: Process) => {
  const purchaseAmountQuery = container.model
    .storePurchaseTable()
    .modify(StoreQuery.purchaseAmount)
    .modify(StoreQuery.purchaseJoinWallet)
    .whereRaw(`${walletTableName}.user = "${userTableName}".id`)
    .toQuery();
  const notificationsCountQuery = container.model
    .notificationTable()
    .modify(NotificationQuery.notificationCount)
    .innerJoin(
      userContactTableName,
      `${userContactTableName}.id`,
      `${notificationTableName}.contact`,
    )
    .whereRaw(`${userContactTableName}.user = "${userTableName}".id`)
    .toQuery();

  const notifications = await container.model
    .userNotificationTable()
    .select(`${userNotificationTableName}.id as notificationId`)
    .innerJoin(
      userContactTableName,
      `${userNotificationTableName}.contact`,
      `${userContactTableName}.id`,
    )
    .innerJoin(userTableName, `${userContactTableName}.user`, `${userTableName}.id`)
    .where(`${userContactTableName}.status`, ContactStatus.Active)
    .where(`${userNotificationTableName}.type`, UserNotificationType.PortfolioMetrics)
    .whereRaw(
      `to_char(NOW() AT TIME ZONE "${userTableName}".timezone,'HH24') = to_char("${userNotificationTableName}".time,'HH24')`,
    )
    .whereRaw(`(${purchaseAmountQuery}) - (${notificationsCountQuery}) > 0`);

  await Promise.all(
    notifications.map(({ notificationId }) =>
      container.model.queueService().push('notificationPortfolioMetricsNotify', {
        notificationId,
      }),
    ),
  );

  return process.done();
};
