import container from '@container';
import { Action, ActionSkipReason } from '@models/Automate/Entity';
import { ContactStatus, NotificationType } from '@models/Notification/Entity';
import * as uuid from 'uuid';

export interface Params {
  contactId: string;
  message: string;
}

export function paramsVerify(params: any): params is Params {
  const { contactId, message } = params;
  if (typeof contactId !== 'string' || !uuid.validate(contactId)) {
    throw new Error('Invalid contract');
  }
  if (typeof message !== 'string' || message === '') {
    throw new Error('Invalid message');
  }

  return true;
}

export default async function (this: Action, params: Params) {
  const { contactId, message } = params;

  const contact = await container.model.userContactTable().where('id', contactId).first();
  if (!contact) throw new Error('Contact not found');
  if (contact.status !== ContactStatus.Active) throw new Error('Contact not active');

  const user = await container.model.userTable().where('id', contact.user).first();
  if (!user) throw new Error('User not found');

  const availableNotifications = await container.model.storeService().availableNotifications(user);
  if (availableNotifications <= 0) {
    await container.model.automateService().updateAction({
      ...this,
      skipReason: ActionSkipReason.NotAvailableNotification,
    });
    throw new Error('Not available notifications');
  }

  await container.model.notificationService().create(contact, {
    type: NotificationType.trigger,
    payload: { message },
  });
}
