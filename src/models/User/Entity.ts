import { tableFactoryLegacy } from '@services/Database';
import { Locale } from '@services/I18n/container';

export enum Role {
  Demo = 'demo',
  User = 'user',
  UserST = 'userST',
  Admin = 'admin',
}

export interface User {
  id: string;
  role: Role;
  name: string;
  referrer: string | null;
  isPorfolioCollected: boolean;
  locale: Locale;
  timezone: string;
  authAt: Date;
  isMetricsTracked: boolean;
  lastSeenAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'user';

export const tableFactory = tableFactoryLegacy<User>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
