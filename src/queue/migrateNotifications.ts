import container from '@container';
import { UserNotification, UserNotificationLegacy } from '@models/UserNotification/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const notifications = await container.model.userNotificationTable();
  const contacts = await container.model.userContactTable().whereIn(
    'user',
    notifications.map((v: any) => v.user),
  );

  await Promise.all(
    notifications.map(async (notification: UserNotification) => {
      if ((notification as UserNotificationLegacy).user === null) {
        return null;
      }

      const contact = contacts.find((v) => v.id === (notification as UserNotificationLegacy).user);
      if (!contact) return null;

      return container.model.userNotificationTable().where('id', notification.id).update({
        contact: contact.id,
      });
    }),
  );

  return process.done();
};
