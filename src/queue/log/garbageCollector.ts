import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  await container.model
    .logTable()
    .where('createdAt', '<', dayjs().add(-1, 'week').toDate())
    .delete();

  return process.done();
};
