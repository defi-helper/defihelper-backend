import { tableFactory as createTableFactory } from '@services/Database';

export enum ContactBroker {
  Email='email',
  Telegram='telegram',
}


export enum ContactStatus {
  Active='active',
  Inactive='inactive',
}

export interface Contact {
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
  new='new',
  processed='processed',
}

export enum NotificationType {
  event='event',
}

export type NotificationPayload = {
  [key: string]: string | boolean | number | NotificationPayload;
}

export interface Notification {
  id: string;
  contact: string;
  type: NotificationType;
  payload: NotificationPayload;
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
}

export interface WebHook {
  id: string
  contract: string;
  event: string;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  user: string;
  webHook: string;
  contact: string;
  createdAt: Date;
}

export const contactTableName = 'contact';

export const contactTableFactory =
    createTableFactory<Contact>(contactTableName);

export type ContactTable = ReturnType<ReturnType<typeof contactTableFactory>>;



export const notificationTableName = 'notification';

export const notificationTableFactory =
  createTableFactory<Notification>(notificationTableName);

export type NotificationTable = ReturnType<ReturnType<typeof notificationTableFactory>>;



export const webHookTableName = 'webhook';

export const webHookTableFactory =
    createTableFactory<WebHook>(webHookTableName);

export type WebHookTable = ReturnType<ReturnType<typeof webHookTableFactory>>;



export const subscriptionTableName = 'subscription';

export const subscriptionTableFactory =
    createTableFactory<Subscription>(subscriptionTableName);

export type SubscriptionTable = ReturnType<ReturnType<typeof subscriptionTableFactory>>;