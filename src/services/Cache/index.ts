import { Factory } from '@services/Container';
import redis, { RedisClient } from 'redis';
import asyncify from 'callback-to-async-iterator';

export interface ConnectFactoryConfig {
  readonly host?: string;
  readonly port?: number;
  readonly password?: string;
  readonly database?: string | number;
  readonly tls?: boolean;
}

export interface PromisifyRedisClient extends RedisClient {
  promises: {
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    set(key: string, value: string): Promise<'OK'>;
    setex(key: string, ttl: number, value: string): Promise<string>;
  };
}

export function redisConnectFactory(config: ConnectFactoryConfig) {
  return () => {
    const client = redis.createClient({
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
    }) as PromisifyRedisClient;
    client.promises = {
      get(key) {
        return new Promise((resolve, reject) =>
          client.get(key, (err, result) => {
            return err ? reject(err) : resolve(result);
          }),
        );
      },
      del(key) {
        return new Promise((resolve, reject) =>
          client.del(key, (err, result) => {
            return err ? reject(err) : resolve(result);
          }),
        );
      },
      set(key, value) {
        return new Promise((resolve, reject) =>
          client.set(key, value, (err, result) => {
            return err ? reject(err) : resolve(result);
          }),
        );
      },
      setex(key, ttl, value) {
        return new Promise((resolve, reject) =>
          client.setex(key, ttl, value, (err, result) => {
            return err ? reject(err) : resolve(result);
          }),
        );
      },
    };

    return client;
  };
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
    lock(key: string, ttl?: number) {
      return new Promise((resolve, reject) => {
        cache().setnx(key, '', (err, reply) => {
          if (err) return reject(err);
          if (reply === 0) return reject(new Error('Lock failed'));
          if (typeof ttl === 'number') cache().expire(key, ttl);
          return resolve(key);
        });
      });
    },

    async wait(lock: () => Promise<boolean>, options: { interval?: number } = {}) {
      const interval = options.interval ?? 500;

      return new Promise((resolve) => {
        const timer = setInterval(async () => {
          if (await lock()) return;
          clearInterval(timer);

          resolve(null);
        }, interval);
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

    async synchronized<T>(
      key: string,
      resolve: () => T | Promise<T>,
      options: { ttl?: number; interval?: number } = {},
    ): Promise<T> {
      await this.wait(
        () =>
          this.lock(key, options.ttl)
            .then(() => true)
            .catch(() => false),
        { interval: options.interval },
      );
      const result = await resolve();
      await this.unlock(key);

      return result;
    },
  });
}

export type Semafor = ReturnType<ReturnType<typeof redisLockFactory>>;
