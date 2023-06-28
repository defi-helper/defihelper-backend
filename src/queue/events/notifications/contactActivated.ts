import container from '@container';
import { ContactBroker } from '@models/Notification/Entity';
import { UserNotificationType } from '@models/UserNotification/Entity';
import { Process } from '@models/Queue/Entity';

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const contact = await container.model.userContactTable().where('id', id).first();
  if (!contact) throw new Error('Contact not found');

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) throw new Error('User not found');

  await container.model.userService().update({
    ...user,
    isMetricsTracked: true,
  });
  if (contact.broker === ContactBroker.Telegram) {
    await container.model
      .userNotificationService()
      .enable(contact, UserNotificationType.PortfolioMetrics, '12:00');
  }

  return process.done();
};
