import { tableFactoryLegacy } from '@services/Database';

export interface Message {
  id: string;
  source: string;
  message: string;
  createdAt: Date;
}

export const logTableName = 'log';

export const logTableFactory = tableFactoryLegacy<Message>(logTableName);

export type LogTable = ReturnType<ReturnType<typeof logTableFactory>>;
