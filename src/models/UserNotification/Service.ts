import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import {
  UserNotification,
  UserNotificationTable,
  UserNotificationType,
} from '@models/UserNotification/Entity';

export class UserNotificationService {
  constructor(readonly table: Factory<UserNotificationTable>) {}

  async enable(user: User, type: UserNotificationType): Promise<void> {
    const duplicates = await this.table().where({
      user: user.id,
      type,
    });
    if (duplicates.length > 0) {
      return;
    }

    const created: UserNotification = {
      id: uuid(),
      user: user.id,
      type,
      createdAt: new Date(),
    };

    await this.table().insert(created);
  }

  async disable(user: User, type: UserNotificationType): Promise<void> {
    await this.table()
      .where({
        user: user.id,
        type,
      })
      .delete();
  }
}
