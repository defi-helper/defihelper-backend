import container from '@container';
import { Process } from '@models/Queue/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const user = await container.model.userTable().where('id', id).first();
  if (!user) throw new Error('User not found');

  await Promise.all(
    Object.values(UserNotificationType).map((t) =>
      container.model.userNotificationService().enable(user, t as UserNotificationType),
    ),
  );

  return process.done();
};
