import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { LogService } from '@models/Log/Service';
import dayjs from 'dayjs';
import { Rabbit } from 'rabbit-queue';
import { Task, TaskStatus, Table, Process } from './Entity';
import * as Handlers from '../../queue';

type Handler = keyof typeof Handlers;

export interface PushOptions {
  startAt?: Date;
  collisionSign?: string;
  scanner?: boolean;
  priority?: number;
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
  ) {}

  async push<H extends Handler>(handler: H, params: Object, options: PushOptions = {}) {
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
      scanner: options.scanner ?? false,
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
      task.status = TaskStatus.Process;
      this.rabbitmq().publishTopic(`tasks.${task.handler}.${task.topic}`, task, {
        priority: task.priority,
      });
    }

    await this.queueTable().insert(task);
  }

  async deferred(limit: number) {
    const candidates = await this.queueTable()
      .where('status', TaskStatus.Pending)
      .andWhere('startAt', '<=', new Date())
      .orderBy('startAt', 'asc')
      .orderBy('priority', 'desc')
      .limit(limit);

    await Promise.all(
      candidates.map(async (task) => {
        const lock = await this.queueTable().update({ status: TaskStatus.Process }).where({
          id: task.id,
          status: TaskStatus.Pending,
        });
        if (lock === 0) return;

        await this.rabbitmq().publishTopic(`tasks.${task.handler}.${task.topic}`, task, {
          priority: task.priority,
        });
      }),
    );
  }

  async consumer(msg: any, ack: (error?: any, reply?: any) => any) {
    const task: Task = JSON.parse(msg.content.toString());
    const process = new Process(task);
    try {
      const { task: result } = await Handlers[task.handler].default(process);
      await this.queueTable().update(result).where('id', task.id);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(`${e}`);

      await Promise.all([
        task.scanner
          ? this.queueTable()
              .update(process.later(dayjs().add(10, 'seconds').toDate()).task)
              .where('id', task.id)
          : this.queueTable().update(process.error(error).task).where('id', task.id),
        this.logService().create(`queue:${task.handler}`, `${task.id} ${error.stack ?? error}`),
      ]);
    } finally {
      ack();
    }
  }

  consume({ queue }: ConsumerOptions) {
    this.rabbitmq().createQueue(
      queue ?? 'tasks_other',
      { durable: false },
      this.consumer.bind(this),
    );
  }
}
