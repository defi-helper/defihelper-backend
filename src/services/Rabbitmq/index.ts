import * as amqp from 'amqplib';
import { Rabbit } from 'rabbit-queue';

export interface QueueConfig {
  name: string;
  topic: string;
}

export interface Config {
  host: string;
  options?: {
    prefetch?: number;
    replyPattern?: boolean;
    scheduledPublish?: boolean;
    socketOptions?: {};
  };
  queues?: QueueConfig[];
}

export function queuesInit(connect: Rabbit, queues: QueueConfig[]) {
  return Promise.all(
    queues.map(async (queue) => {
      await connect.createQueue(queue.name, {
        durable: false,
        maxPriority: 9,
        priority: 9,
      } as amqp.Options.AssertQueue);
      await connect.bindToTopic(queue.name, queue.topic);
    }),
  );
}

export function rabbitmqFactory({ host, options, queues }: Config) {
  return () => {
    const connect = new Rabbit(host, options);
    connect.on('connected', () => queuesInit(connect, queues ?? []));
    connect.on('disconnected', () => {
      setTimeout(() => connect.reconnect(), 5000);
    });
    connect.on('log', () => {});

    return connect;
  };
}
