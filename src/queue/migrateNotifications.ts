import container from '@container';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const notifications = await container.model.userNotificationTable().whereNot('user', null);
  const contacts = await container.model.userContactTable().whereIn(
    'user',
    notifications.map((v: any) => v.user),
  );

  await Promise.all(
    notifications.map(async (notification) => {
      const contact = contacts.find((v) => v.id === (notification as any).user);
      if (!contact) return null;

      return container.model.userNotificationTable().where('id', notification.id).update({
        contact: contact.id,
      });
    }),
  );

  return process.done();
};
