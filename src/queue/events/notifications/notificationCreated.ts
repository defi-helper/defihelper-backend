import container from '@container';
import { ContactBroker, ContactStatus } from '@models/Notification/Entity';
import { Process } from '@models/Queue/Entity';
import { User } from '@models/User/Entity';

async function getContacts(user: User) {
  const [emailContact, telegramContact] = await Promise.all([
    container.model
      .userContactTable()
      .where('user', user.id)
      .where('broker', ContactBroker.Email)
      .where('status', ContactStatus.Active)
      .first(),
    container.model
      .userContactTable()
      .where('user', user.id)
      .where('broker', ContactBroker.Telegram)
      .where('status', ContactStatus.Active)
      .first(),
  ]);

  return { email: emailContact, telegram: telegramContact };
}

export interface Params {
  id: string;
}

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const notification = await container.model.notificationTable().where('id', id).first();
  if (!notification) {
    throw new Error('Notification not found');
  }

  const contact = await container.model
    .userContactTable()
    .where('id', notification.contact)
    .first();
  if (!contact) {
    throw new Error('Contact not found');
  }

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) {
    throw new Error('User not found');
  }

  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications === 5) {
    const { email, telegram } = await getContacts(user);
    await Promise.all([
      email
        ? container
            .email()
            .send('NotificationsFew', {}, 'Notifications few', contact.address, user.locale)
        : null,
      telegram
        ? container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'notificationsFew',
            params: {},
          })
        : null,
    ]);
  }
  if (availableNotifications === 0) {
    const { email, telegram } = await getContacts(user);
    await Promise.all([
      email
        ? container
            .email()
            .send('NotificationsOver', {}, 'Notifications over', contact.address, user.locale)
        : null,
      telegram
        ? container.model.queueService().push('sendTelegramByContact', {
            contactId: contact.id,
            template: 'notificationsOver',
            params: {},
          })
        : null,
    ]);
  }

  return process.done();
};
