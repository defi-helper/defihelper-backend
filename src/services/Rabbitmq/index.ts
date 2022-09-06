import { Emitter, Listener } from '@services/Event';
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

export type Consumer = (msg: any, ack: (error?: any, reply?: any) => any) => Promise<any>;

export function useStopableConsumer(listener?: Listener<void>) {
  let isStoped = false;
  let isConsume = false;
  const onStop = new Emitter<void>(...(listener ? [listener] : []));

  return {
    onStop,
    stop() {
      isStoped = true;
      if (!isConsume) onStop.emit();
    },
    consume(consumer: Consumer): Consumer {
      return async (msg, ack) => {
        if (isStoped) return;
        isConsume = true;

        await consumer(msg, ack);

        isConsume = false;
        if (isStoped) setTimeout(() => onStop.emit(), 500); // for ack work
      };
    },
  };
}
