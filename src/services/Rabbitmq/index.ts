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
    queues.map((queue) =>
      connect
        .createQueue(queue.name, { durable: false })
        .then(() => connect.bindToTopic(queue.name, queue.topic)),
    ),
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
