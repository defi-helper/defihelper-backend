import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import {
  UserNotification,
  UserNotificationTable,
  UserNotificationType,
} from '@models/UserNotification/Entity';
import { UserContact } from '@models/Notification/Entity';

export class UserNotificationService {
  constructor(readonly table: Factory<UserNotificationTable>) {}

  async isNotificationEnabled(contact: UserContact, type: UserNotificationType): Promise<boolean> {
    const c = await this.table().count('id').where({ contact: contact.id, type }).first();
    return c !== undefined && c.count > 0;
  }

  async enable(
    contact: UserContact,
    type: UserNotificationType,
    time: string,
  ): Promise<UserNotification> {
    const duplicates = await this.table().where({
      contact: contact.id,
      type,
    });
    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: UserNotification = {
      id: uuid(),
      contact: contact.id,
      user: contact.user,
      type,
      time,
      createdAt: new Date(),
    };

    await this.table().insert(created);
    return created;
  }

  async disable(contact: UserContact, type: UserNotificationType): Promise<void> {
    await this.table()
      .where({
        contact: contact.id,
        type,
      })
      .delete();
  }
}
