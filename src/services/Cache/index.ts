import { Factory } from '@services/Container';
import redis, { RedisClient } from 'redis';
import asyncify from 'callback-to-async-iterator';
import Redis from 'ioredis';

export interface ConnectFactoryConfig {
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly database?: string | number;
  readonly tls?: boolean;
}

export function redisLegacyConnectFactory(config: ConnectFactoryConfig) {
  return () =>
    redis.createClient({
      tls: config.tls
        ? {
            host: config.host,
            port: config.port,
          }
        : undefined,
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.database,
    });
}

export function redisConnectFactory(config: ConnectFactoryConfig) {
  return () =>
    new Redis({
      port: config.port,
      host: config.host,
      password: config.password,
      db: Number(config.database) ?? 0,
    });
}

export function redisSubscriberFactory(
  connectFactory: Factory<redis.RedisClient>,
  maxListeners: number,
) {
  return (channel: string) => {
    const subscriber = connectFactory().duplicate();
    subscriber.subscribe(channel);
    subscriber.setMaxListeners(maxListeners);

    return {
      subscriber,
      onJSON<T = any>(callback: (msg: T) => any) {
        const handler = (_: unknown, message: string) => callback(JSON.parse(message));
        subscriber.on('message', handler);

        return handler;
      },
      asyncIterator() {
        return asyncify((callback) => Promise.resolve(this.onJSON(callback)), {
          onClose: (handler) => subscriber.off('message', handler),
        });
      },
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
