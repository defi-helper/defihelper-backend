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

export function rabbitmqFactory({ host, options, queues }: Config) {
  return () => {
    const connect = new Rabbit(host, options);
    queues?.forEach((queue) =>
      connect
        .createQueue(queue.name, { durable: false })
        .then(() => connect.bindToTopic(queue.name, queue.topic)),
    );
    connect
      .on('log', () => {})
      .on('disconnected', () => {
        throw new Error('Rabbit disconnected');
      });

    return connect;
  };
}
