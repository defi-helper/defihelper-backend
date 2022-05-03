import { tableFactoryLegacy } from '@services/Database';

export interface ReferrerCode {
  id: string;
  user: string;
  code: string;
  redirectTo: string;
  usedTimes: number;
  createdAt: Date;
}

export const referrerCodeTableName = 'user_referrer_code';

export const referrerCodeTableFactory = tableFactoryLegacy<ReferrerCode>(referrerCodeTableName);

export type ReferrerCodeTable = ReturnType<ReturnType<typeof referrerCodeTableFactory>>;
