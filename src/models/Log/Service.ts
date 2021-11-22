import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { LogTable, Message } from './Entity';

export class LogService {
  constructor(readonly logTable: Factory<LogTable>) {}

  async create(source: string, message: Error | string) {
    const created: Message = {
      id: uuid(),
      source,
      message: message instanceof Error ? message.stack ?? message.toString() : message,
      createdAt: new Date(),
    };
    await this.logTable().insert(created);

    return created;
  }
}
