import { tableFactoryLegacy } from '@services/Database';
import dayjs from 'dayjs';
import * as Handlers from '../../queue';

export enum TaskStatus {
  Pending = 'pending',
  Process = 'process',
  Done = 'done',
  Error = 'error',
}

export function hasHandler(handler: string): handler is keyof typeof Handlers {
  return Object.prototype.hasOwnProperty.call(Handlers, handler);
}

export class Process {
  constructor(readonly task: Task) {}

  param(params: Object) {
    return new Process({
      ...this.task,
      params,
    });
  }

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

  later(startAt: dayjs.Dayjs | Date) {
    return new Process({
      ...this.task,
      status: TaskStatus.Pending,
      startAt: startAt instanceof Date ? startAt : startAt.toDate(),
      updatedAt: new Date(),
    });
  }

  laterAt(value: number, unit?: dayjs.OpUnitType | undefined) {
    return this.later(dayjs().add(value, unit));
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

export interface Task {
  id: string;
  handler: keyof typeof Handlers;
  params: Object;
  startAt: Date;
  status: TaskStatus;
  info: string;
  error: string;
  priority: number;
  topic: string;
  scanner: boolean;
  executionTime: number | null;
  attempt: number;
  updatedAt: Date;
  createdAt: Date;
}

export const tableName = 'queue';

export const tableFactory = tableFactoryLegacy<Task>(tableName);

export type Table = ReturnType<ReturnType<typeof tableFactory>>;
