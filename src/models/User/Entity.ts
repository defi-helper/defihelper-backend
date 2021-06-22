import { tableFactory as createTableFactory } from '@services/Database';

export enum Role {
  User = 'user',
  Admin = 'admin',
}

export interface User {
  id: string;
  role: Role;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'user';

export const tableFactory = createTableFactory<User>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
