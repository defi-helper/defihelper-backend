import knex from 'knex';
import { Factory } from '@services/Container';

export interface ConnectFactoryConfig {
  readonly host?: string;
  readonly port?: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export function pgConnectFactory(config: ConnectFactoryConfig) {
  return () =>
    knex({
      client: 'pg',
      connection: config,
    });
}

export function tableFactory<R extends any = {}, L extends any[] = R[]>(
  table: string,
  schema: string = 'public',
) {
  return (connectFactory: Factory<knex>) => () => {
    const connect = connectFactory();

    return connect<R, L>(table).withSchema(schema);
  };
}
