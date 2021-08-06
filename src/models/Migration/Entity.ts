import { Factory } from '@services/Container';
import { tableFactory as createTableFactory } from '@services/Database';
import { Log } from '@services/Log';
import Knex from 'knex';

export interface Migration {
  name: string;
  createdAt: Date;
}

export const tableName = 'migration';

export const tableFactory = createTableFactory<Migration>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;

export async function migrate(log: Factory<Log>, database: Factory<Knex>) {
  const { schema } = database();
  if (await schema.hasTable(tableName)) return;

  log().info('Migrations init');
  await schema.createTable(tableName, (table) => {
    table.string('name', 512).notNullable().primary('migration_pkey');
    table.dateTime('createdAt').notNullable();
  });
}
