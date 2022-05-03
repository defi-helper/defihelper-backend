import container from '@container';
import { Process } from '@models/Queue/Entity';
import dayjs from 'dayjs';

export default async (process: Process) => {
  const users = await container.model.userTable();
  const queue = container.model.queueService();
  const lag = 3600 / users.length;
  await users.reduce<Promise<dayjs.Dayjs>>(async (startAtPromise, user) => {
    const startAt = await startAtPromise;
    await queue.push(
      'metricsUserBalancesFiller',
      {
        userId: user.id,
      },
      {
        startAt: startAt.toDate(),
      },
    );

    return startAt.clone().add(lag, 'seconds');
  }, Promise.resolve(dayjs()));

  return process.done();
};
