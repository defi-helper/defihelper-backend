import { tableFactory as createTableFactory } from '@services/Database';

export enum ContactBroker {
  Email = 'email',
  Telegram = 'telegram',
}

export enum ContactStatus {
  Active = 'active',
  Inactive = 'inactive',
}

export interface UserContact {
  id: string;
  user: string;
  type: ContactBroker;
  address: string;
  status: ContactStatus;
  confirmationCode: string;
  createdAt: Date;
  activatedAt?: Date;
}

export enum NotificationStatus {
  new = 'new',
  processed = 'processed',
}

export enum NotificationType {
  event = 'event',
}

export interface Notification {
  id: string;
  contact: string;
  type: NotificationType;
  payload: Object;
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
}

export interface ContractEventWebHook {
  id: string;
  contract: string;
  event: string;
  createdAt: Date;
}

export interface UserEventSubscription {
  id: string;
  webHook: string;
  contact: string;
  createdAt: Date;
}

export const userContactTableName = 'user_contact';

export const userContactTableFactory = createTableFactory<UserContact>(userContactTableName);

export type UserContactTable = ReturnType<ReturnType<typeof userContactTableFactory>>;

export const notificationTableName = 'notification';

export const notificationTableFactory = createTableFactory<Notification>(notificationTableName);

export type NotificationTable = ReturnType<ReturnType<typeof notificationTableFactory>>;

export const contractEventWebHookTableName = 'contract_event_webhook';

export const contractEventWebHookTableFactory = createTableFactory<ContractEventWebHook>(
  contractEventWebHookTableName,
);

export type ContractEventWebHookTable = ReturnType<
  ReturnType<typeof contractEventWebHookTableFactory>
>;

export const userEventSubscriptionTableName = 'user_event_subscription';

export const userEventSubscriptionTableFactory = createTableFactory<UserEventSubscription>(
  userEventSubscriptionTableName,
);

export type UserEventSubscriptionTable = ReturnType<
  ReturnType<typeof userEventSubscriptionTableFactory>
>;
