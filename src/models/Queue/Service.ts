import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { LogService } from '@models/Log/Service';
import { Log } from '@services/Log';
import dayjs from 'dayjs';
import { Rabbit } from 'rabbit-queue';
import { Task, TaskStatus, Table, Process } from './Entity';
import * as Handlers from '../../queue';

type Handler = keyof typeof Handlers;

export interface PushOptions {
  startAt?: Date;
  watcher?: boolean;
  priority?: number;
  collisionSign?: string;
  topic?: string;
}

export interface ConsumerOptions {
  queue?: string;
}

export class QueueService {
  static readonly defaultPriority = 5; // min - 0, max - 9

  static readonly defaultTopic = 'default';

  constructor(
    readonly queueTable: Factory<Table>,
    readonly rabbitmq: Factory<Rabbit>,
    readonly logService: Factory<LogService>,
    readonly logger: Factory<Log>,
  ) {}

  async push<H extends Handler>(handler: H, params: Object = {}, options: PushOptions = {}) {
    let task: Task = {
      id: uuid(),
      handler,
      params,
      startAt: options.startAt ?? new Date(),
      status: TaskStatus.Pending,
      info: '',
      error: '',
      collisionSign: options.collisionSign ?? null,
      priority: options.priority ?? QueueService.defaultPriority,
      topic: options.topic ?? QueueService.defaultTopic,
      watcher: options.watcher ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (typeof options.collisionSign === 'string') {
      const duplicate = await this.queueTable()
        .where({
          collisionSign: options.collisionSign,
        })
        .whereIn('status', [TaskStatus.Pending, TaskStatus.Process])
        .first();
      if (duplicate) {
        task = {
          ...task,
          status: TaskStatus.Collision,
          error: `Duplicate for ${duplicate.id}`,
        };
      }
    }

    if (!dayjs(task.startAt).isAfter(new Date())) {
      await this.queueTable().insert({
        ...task,
        status: TaskStatus.Process,
      });
      await this.rabbitmq()
        .publishTopic(`tasks.${task.handler}.${task.topic}`, task, {
          priority: task.priority,
        })
        .catch(() =>
          this.queueTable()
            .update({
              ...task,
              status: TaskStatus.Pending,
            })
            .where('id', task.id),
        );
      return task;
    }

    await this.queueTable().insert(task);
    return task;
  }

  async getCandidates(limit: number) {
    return this.queueTable()
      .where('status', TaskStatus.Pending)
      .andWhere('startAt', '<=', new Date())
      .orderBy('startAt', 'asc')
      .orderBy('priority', 'desc')
      .limit(limit);
  }

  async lock({ id }: Task) {
    const lock = await this.queueTable().update({ status: TaskStatus.Process }).where({
      id,
      status: TaskStatus.Pending,
    });
    if (lock === 0) return false;

    return true;
  }

  async deferred(limit: number) {
    const candidates = await this.getCandidates(limit);

    await Promise.all(
      candidates.map(async (task) => {
        const isLocked = await this.lock(task);
        if (!isLocked) return;

        await this.rabbitmq().publishTopic(`tasks.${task.handler}.${task.topic}`, task, {
          priority: task.priority,
        });
      }),
    );
  }

  async handle(task: Task) {
    const process = new Process(task);
    try {
      const { task: result } = await Handlers[task.handler].default(process);
      return await this.queueTable().update(result).where('id', task.id);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(`${e}`);

      return Promise.all([
        task.watcher
          ? this.queueTable()
              .update(process.later(dayjs().add(10, 'seconds').toDate()).task)
              .where('id', task.id)
          : this.queueTable().update(process.error(error).task).where('id', task.id),
        this.logService().create(`queue:${task.handler}`, `${task.id} ${error.stack ?? error}`),
      ]);
    }
  }

  async consumer(msg: any, ack: (error?: any, reply?: any) => any) {
    const task: Task = JSON.parse(msg.content.toString());
    this.logger().info(`Handle task: ${task.id}`);
    await this.handle(task);
    ack();
  }

  consume({ queue }: ConsumerOptions) {
    this.rabbitmq().createQueue(
      queue ?? 'tasks_default',
      { durable: false },
      this.consumer.bind(this),
    );
  }
}
