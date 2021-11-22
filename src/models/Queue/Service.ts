import { v4 as uuid } from 'uuid';
import { Factory } from '@services/Container';
import { LogService } from '@models/Log/Service';
import dayjs from 'dayjs';
import { Task, TaskStatus, Table, Process, hasHandler } from './Entity';
import * as Handlers from '../../queue';

type Handler = keyof typeof Handlers;

export interface HandleOptions {
  include?: Handler[];
  exclude?: Handler[];
}

export interface BrokerOptions {
  interval: number;
  handler: HandleOptions;
}

export class Broker {
  protected isStarted: boolean = false;

  constructor(readonly service: QueueService, readonly options: Partial<BrokerOptions> = {}) {
    this.options = {
      interval: 1000,
      ...options,
    };
  }

  protected async handle() {
    if (!this.isStarted) return;

    const res = await this.service.handle(this.options.handler);
    if (!res) {
      await new Promise((resolve) => {
        setTimeout(resolve, this.options.interval);
      });
    }

    this.handle();
  }

  start() {
    this.isStarted = true;
    this.handle();
  }

  stop() {
    this.isStarted = false;
  }
}

export interface PushOptions {
  startAt?: Date;
  collisionSign?: string;
  scanner?: boolean;
}

export class QueueService {
  constructor(readonly queueTable: Factory<Table>, readonly logService: Factory<LogService>) {}

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

    await this.queueTable().insert(task);

    return task;
  }

  async handle(options: HandleOptions = {}): Promise<boolean> {
    const current = await this.queueTable()
      .where(function () {
        this.where('status', TaskStatus.Pending).andWhere('startAt', '<=', new Date());
        if (options.include && options.include.length > 0) {
          this.whereIn('handler', options.include);
        }
        if (options.exclude && options.exclude.length > 0) {
          this.whereNotIn('handler', options.exclude);
        }
      })
      .orderBy('startAt', 'asc')
      .limit(1)
      .first();
    if (!current) return false;

    const lock = await this.queueTable().update({ status: TaskStatus.Process }).where({
      id: current.id,
      status: TaskStatus.Pending,
    });
    if (lock === 0) return false;

    const process = new Process(current);
    try {
      const { task: result } = await Handlers[current.handler].default(process);
      await this.queueTable().update(result).where('id', current.id);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(`${e}`);

      await Promise.all([
        current.scanner
          ? this.queueTable()
              .update(process.later(dayjs().add(10, 'seconds').toDate()).task)
              .where('id', current.id)
          : this.queueTable().update(process.error(error).task).where('id', current.id),
        this.logService().create(
          `queue:${current.handler}`,
          `${current.id} ${error.stack ?? error}`,
        ),
      ]);
    }

    return true;
  }

  createBroker(options: Partial<BrokerOptions> = {}) {
    if (typeof options.handler === 'string' && !hasHandler(options.handler)) {
      throw new Error(`Invalid queue handler "${options.handler}"`);
    }
    return new Broker(this, options);
  }
}
