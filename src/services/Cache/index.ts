import redis from 'redis';
import { Factory } from '@services/Container';

export interface ConnectFactoryConfig {
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly database?: string | number;
}

export function redisConnectFactory(config: ConnectFactoryConfig) {
  return () =>
    redis.createClient({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.database,
    });
}
