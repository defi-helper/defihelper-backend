import container from '@container';
import { UserNotification, userNotificationTableName } from '@models/UserNotification/Entity';
import { Process } from '@models/Queue/Entity';

export interface UserNotificationLegacy extends UserNotification {
  user: string | null;
}

export default async (process: Process) => {
  const notifications = await container.database()<UserNotificationLegacy>(
    userNotificationTableName,
  );
  const contacts = await container.model.userContactTable().whereIn(
    'user',
    notifications.map((v) => v.user),
  );

  await Promise.all(
    notifications.map(async (notification) => {
      if (!notification.user) {
        return null;
      }

      const contact = contacts.find((v) => v.id === notification.user);
      if (!contact) return null;

      return container.model.userNotificationTable().where('id', notification.id).update({
        contact: contact.id,
        user: null,
      });
    }),
  );

  return process.done();
};
