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

export type NotificationPayloadType = NotificationEventType | NotificationTriggerType;

export type Notification = {
  id: string;
  contact: string;
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
} & NotificationPayloadType;

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

export const userContactTableFactory = tableFactoryLegacy<UserContact>(userContactTableName);

export type UserContactTable = ReturnType<ReturnType<typeof userContactTableFactory>>;

export const notificationTableName = 'notification';

export const notificationTableFactory = tableFactoryLegacy<Notification>(notificationTableName);

export type NotificationTable = ReturnType<ReturnType<typeof notificationTableFactory>>;

export const contractEventWebHookTableName = 'contract_event_webhook';

export const contractEventWebHookTableFactory = tableFactoryLegacy<ContractEventWebHook>(
  contractEventWebHookTableName,
);

export type ContractEventWebHookTable = ReturnType<
  ReturnType<typeof contractEventWebHookTableFactory>
>;

export const userEventSubscriptionTableName = 'user_event_subscription';

export const userEventSubscriptionTableFactory = tableFactoryLegacy<UserEventSubscription>(
  userEventSubscriptionTableName,
);

export type UserEventSubscriptionTable = ReturnType<
  ReturnType<typeof userEventSubscriptionTableFactory>
>;
