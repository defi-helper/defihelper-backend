import { Process } from '@models/Queue/Entity';
import container from '@container';
import { userContactTableName } from '@models/Notification/Entity';
import { tableName as userTableName } from '@models/User/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const users = await container.model
    .userTable()
    .select(`${userTableName}.id as uId`)
    .innerJoin(userContactTableName, `${userContactTableName}.user`, '=', `${userTableName}.id`)
    .groupBy('uId');

  const lag = 86400 / users.length; // seconds in day
  await users.reduce<Promise<dayjs.Dayjs>>(async (prev, user) => {
    const startAt = await prev;
    await container.model.queueService().push('notificationPortfolioMetricsNotify', {
      userId: user.uId,
    });
    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
