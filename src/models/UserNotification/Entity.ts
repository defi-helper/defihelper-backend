import { tableFactoryLegacy } from '@services/Database';

export enum UserNotificationType {
  PortfolioMetrics = 'portfolioMetrics',
  AutomateCallNotEnoughFunds = 'automateCallNotEnoughFunds',
}

export interface UserNotification {
  id: string;
  contact: string | null;
  user: string | null;
  time: string;
  type: UserNotificationType;
  createdAt: Date;
}

export const userNotificationTableName = 'user_notification';

export const userNotificationTableFactory =
  tableFactoryLegacy<UserNotification>(userNotificationTableName);

export type UserNotificationTable = ReturnType<ReturnType<typeof userNotificationTableFactory>>;
