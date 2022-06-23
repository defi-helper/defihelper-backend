import container from '@container';
import { UserNotificationType } from '@models/UserNotification/Entity';
import { Process } from '@models/Queue/Entity';

export default async (process: Process) => {
  const contacts = await container.model.userContactTable();

  await Promise.all(
    contacts.map(async (contact) => {
      return Promise.all(
        Object.values(UserNotificationType).map((t) =>
          container.model
            .userNotificationService()
            .enable(contact, t as UserNotificationType, '12:00'),
        ),
      );
    }),
  );

  return process.done();
};
