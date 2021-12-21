import { Factory } from '@services/Container';
import redis, { RedisClient } from 'redis';

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

export function redisSubscriberFactory(connectFactory: Factory<redis.RedisClient>) {
  return (channel: string) => {
    const subscriber = connectFactory().duplicate();
    subscriber.subscribe(channel);

    return {
      subscriber,
      onJSON: (callback: <T = any>(msg: T) => any) =>
        subscriber.on('message', (_, message) => callback(JSON.parse(message))),
    };
  };
}

export function redisLockFactory(cache: Factory<RedisClient>) {
  return () => ({
    lock(key: string) {
      return new Promise((resolve, reject) => {
        cache().setnx(key, '', (err, reply) => {
          if (err) return reject(err);
          if (reply === 0) return reject(new Error('Lock failed'));

          return resolve(key);
        });
      });
    },

    unlock(key: string) {
      return new Promise((resolve, reject) => {
        cache().del(key, (err) => {
          if (err) return reject(err);

          return resolve(key);
        });
      });
    },
  });
}
