import { tableFactoryLegacy } from '@services/Database';

export enum ContactBroker {
  Email = 'email',
  Telegram = 'telegram',
}

export enum ContactStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export interface UserContactParams {
  chatId?: string;
}

export interface UserContact {
  id: string;
  user: string;
  broker: ContactBroker;
  name: string;
  address: string;
  status: ContactStatus;
  confirmationCode: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  params?: UserContactParams;
}

export enum NotificationStatus {
  new = 'new',
  processed = 'processed',
}

export enum NotificationType {
  portfolioMetrics = 'portfolioMetrics',
  event = 'event',
  trigger = 'trigger',
}

export interface EventUrls {
  link: string;
  txHash: string;
}

export interface NotificationEventType {
  type: NotificationType.event;
  payload: {
    eventsUrls: EventUrls[];
    eventName: string;
    contractName: string;
    contractUrl: string;
    network: string;
  };
}

export interface NotificationTriggerType {
  type: NotificationType.trigger;
  payload: {
    message: string;
  };
}

export interface NotificationPortfolioMetricType {
  type: NotificationType.portfolioMetrics;
  payload: {};
}

export type NotificationPayloadType =
  | NotificationEventType
  | NotificationTriggerType
  | NotificationPortfolioMetricType;

export type Notification = {
  id: string;
  contact: string;
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
} & NotificationPayloadType;

export const userContactTableName = 'user_contact';

export const userContactTableFactory = tableFactoryLegacy<UserContact>(userContactTableName);

export type UserContactTable = ReturnType<ReturnType<typeof userContactTableFactory>>;

export const notificationTableName = 'notification';

export const notificationTableFactory = tableFactoryLegacy<Notification>(notificationTableName);

export type NotificationTable = ReturnType<ReturnType<typeof notificationTableFactory>>;
