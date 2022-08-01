import dayjs from 'dayjs';

export interface Log {
  debug(msg: string): any;

  info(msg: string): any;

  warn(msg: string): any;

  error(msg: string): any;
}

/* eslint-disable no-console */
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
}
