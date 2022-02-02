import knex from 'knex';
import { Factory } from '@services/Container';
import { Tables } from 'knex/types/tables';

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
