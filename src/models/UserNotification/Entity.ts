import { tableFactory as createTableFactory } from '@services/Database';

export enum UserNotificationType {
  PortfolioMetrics = 'portfolioMetrics',
}

export interface UserNotification {
  id: string;
  user: string;
  type: UserNotificationType;
  createdAt: Date;
}

export const userNotificationTableName = 'user_notification';

export const userNotificationTableFactory =
  createTableFactory<UserNotification>(userNotificationTableName);

export type UserNotificationTable = ReturnType<ReturnType<typeof userNotificationTableFactory>>;
