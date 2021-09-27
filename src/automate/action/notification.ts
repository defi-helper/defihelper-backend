import container from '@container';
import { ContactStatus, NotificationType } from '@models/Notification/Entity';

interface Params {
  contactId: string;
  message: string;
}

export default async (params: Params) => {
  const { contactId, message } = params;

  const contact = await container.model.userContactTable().where('id', contactId).first();
  if (!contact) throw new Error('Contact not found');
  if (contact.status !== ContactStatus.Active) throw new Error('Contact not active');

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) throw new Error('User not found');

  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications <= 0) throw new Error('Not available notifications');

  await container.model.notificationService().create(contact, {
    type: NotificationType.trigger,
    payload: {
      message,
    },
  });
};
