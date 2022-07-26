import knex from 'knex';
import { Factory } from '@services/Container';
import { Tables } from 'knex/types/tables';
import fs from 'fs';

export interface ConnectFactoryConfig {
  readonly host?: string;
  readonly port?: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl: string;
}

export function pgConnectFactory(config: ConnectFactoryConfig) {
  return () => {
    return knex({
      client: 'pg',
      pool: {
        min: 1,
        max: 30,
      },
      connection: {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl
          ? {
              ca: fs.readFileSync(config.ssl),
            }
          : undefined,
      },
    });
  };
}

export function tableFactoryLegacy<R extends any = {}, L extends any[] = R[]>(
  table: string,
  schema: string = 'public',
) {
  return (connectFactory: Factory<knex>) => () => {
    const connect = connectFactory();

    return connect<R, L>(table).withSchema(schema);
  };
}

export function typedTableFactory<TTable extends keyof Tables>(
  table: TTable,
  schema: string = 'public',
) {
  return (connectFactory: Factory<knex>) => () => connectFactory()(table).withSchema(schema);
}
