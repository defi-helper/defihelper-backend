import container from '@container';
import dayjs from 'dayjs';

export enum Level {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export interface Log {
  debug(msg: string): any;

  info(msg: string): any;

  warn(msg: string): any;

  error(msg: string): any;

  log(msg: string | { toString(): string }): any;
}

/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */
export class ConsoleLogger implements Log {
  protected dateFormat: string = ``;

  constructor(public readonly mode: string) {}

  format(type: string, msg: string) {
    return `${type} [${dayjs().format(this.dateFormat)}]: ${msg}`;
  }

  debug(msg: string) {
    if (this.mode !== 'development') return;
    console.debug(this.format('DEBUG', msg));
  }

  info(msg: string) {
    console.log(this.format('INFO', msg));
  }

  warn(msg: string) {
    console.warn(this.format('WARN', msg));
  }

  error(msg: string) {
    console.error(this.format('ERROR', msg));
  }

  log(msg: string | { toString(): string }) {
    console.log(msg.toString());
  }
}

export interface LogPayload {
  [key: string]: string | number | boolean | null | undefined | LogPayload;
}

export class LogJsonMessage {
  public readonly time = new Date();

  constructor(public readonly level: Level, public readonly payload: LogPayload) {}

  static error(payload: LogPayload) {
    return new LogJsonMessage(Level.Error, payload);
  }

  static warn(payload: LogPayload) {
    return new LogJsonMessage(Level.Warn, payload);
  }

  static debug(payload: LogPayload) {
    return new LogJsonMessage(Level.Debug, payload);
  }

  static info(payload: LogPayload) {
    return new LogJsonMessage(Level.Info, payload);
  }

  ex(payload: LogPayload) {
    return new LogJsonMessage(this.level, {
      ...this.payload,
      ...payload,
    });
  }

  toString() {
    return JSON.stringify(this);
  }

  send() {
    container.logger().log(this);
  }
}
