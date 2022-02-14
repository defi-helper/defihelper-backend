import { TaskStatus, Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';

export default async (process: Process) => {
  await Promise.all([
    container.model
      .queueTable()
      .delete()
      .where('status', TaskStatus.Done)
      .andWhere('updatedAt', '<', dayjs().add(-7, 'days').toDate()),
    container.model
      .queueTable()
      .delete()
      .whereIn('status', [TaskStatus.Error, TaskStatus.Collision])
      .andWhere('updatedAt', '<', dayjs().add(-30, 'days').toDate()),
    container.model
      .queueTable()
      .delete()
      .where('status', TaskStatus.Process)
      .andWhere('updatedAt', '<', dayjs().add(-180, 'days').toDate()),
  ]);

  return process.done();
};
