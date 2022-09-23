import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { LogService } from '@models/Log/Service';
import { Log } from '@services/Log';
import dayjs from 'dayjs';
import * as amqp from 'amqplib';
import { Rabbit } from 'rabbit-queue';
import { Task, TaskStatus, Table, Process } from './Entity';
import * as Handlers from '../../queue';

type Handler = keyof typeof Handlers;

export interface PushOptions {
  startAt?: Date;
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
    readonly logger: Factory<Log>,
  ) {}

  async resetAndRestart(task: Task) {
    const updated = {
      ...task,
      status: TaskStatus.Pending,
      startAt: new Date(),
      error: '',
      updatedAt: new Date(),
    };
    await this.queueTable().update(updated).where('id', updated.id);

    return updated;
  }

  async push<H extends Handler>(handler: H, params: Object = {}, options: PushOptions = {}) {
    const task: Task = {
      id: uuid(),
      handler,
      params,
      startAt: options.startAt ?? new Date(),
      status: TaskStatus.Pending,
      info: '',
      error: '',
      priority: options.priority ?? QueueService.defaultPriority,
      topic: options.topic ?? QueueService.defaultTopic,
      scanner: options.scanner ?? false,
      executionTime: null,
      attempt: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

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
      const executionStart = Date.now();
      const { task: result } = await Handlers[task.handler].default(process);
      return await this.queueTable()
        .update({
          ...result,
          executionTime: Date.now() - executionStart,
          attempt: result.attempt + 1,
        })
        .where('id', task.id);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(`${e}`);
      const result = task.scanner
        ? process.later(dayjs().add(10, 'seconds').toDate()).task
        : process.error(error).task;

      return Promise.all([
        this.queueTable()
          .update({ ...result, attempt: result.attempt + 1 })
          .where('id', task.id),
        this.logService().create(`queue:${task.handler}`, `${task.id} ${error.stack ?? error}`),
      ]);
    }
  }

  consume({ queue }: ConsumerOptions) {
    let isConsume = false;
    let isStoped = false;
    const rabbit = this.rabbitmq();
    rabbit.createQueue(
      queue ?? 'tasks_default',
      { durable: false, maxPriority: 9, priority: 9 } as amqp.Options.AssertQueue,
      async (msg, ack) => {
        if (isStoped) return;
        isConsume = true;
        const task: Task = JSON.parse(msg.content.toString());
        this.logger().info(`Handle task: ${task.id}`);
        await this.handle(task);
        ack();
        if (isStoped) setTimeout(() => rabbit.close(), 500); // for ack work
        isConsume = false;
      },
    );

    return {
      stop: () => {
        isStoped = true;
        if (!isConsume) rabbit.close();
      },
    };
  }
}
