import { tableFactory as createTableFactory } from '@services/Database';
import * as Handlers from '../../queue';

export function hasHandler(handler: string): handler is keyof typeof Handlers {
  return Handlers.hasOwnProperty(handler);
}

export class Process {
  constructor(readonly task: Task = task) {}

  info(msg: string) {
    return new Process({
      ...this.task,
      info: `${this.task.info}${msg}`,
    });
  }

  done() {
    return new Process({
      ...this.task,
      status: TaskStatus.Done,
      updatedAt: new Date(),
    });
  }

  later(startAt: Date) {
    return new Process({
      ...this.task,
      status: TaskStatus.Pending,
      startAt,
      updatedAt: new Date(),
    });
  }

  error(e: Error) {
    return new Process({
      ...this.task,
      status: TaskStatus.Error,
      error: e.stack ?? e.toString(),
      updatedAt: new Date(),
    });
  }
}

export enum TaskStatus {
  Pending = 'pending',
  Process = 'process',
  Done = 'done',
  Error = 'error',
  Collision = 'collision',
}

export interface Task {
  id: string;
  handler: keyof typeof Handlers;
  params: Object;
  startAt: Date;
  status: TaskStatus;
  info: string;
  error: string;
  collisionSign: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'queue';

export const tableFactory = createTableFactory<Task>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
