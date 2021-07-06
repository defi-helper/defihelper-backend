import {Factory} from '@services/Container';
import {
  UserContact,
  ContactBroker,
  ContactStatus,
  UserContactTable,
  Notification,
  NotificationPayload,
  NotificationStatus,
  NotificationTable,
  NotificationType,
  UserEventSubscription,
  UserEventSubscriptionTable,
  ContractEventWebHook,
  ContractEventWebHookTable
} from './Entity';
import {v4 as uuid} from "uuid";
import {User} from "@models/User/Entity";
import {Contract} from "@models/Protocol/Entity";

export class NotificationService {
  constructor(
    readonly table: Factory<NotificationTable> = table,
  ) {}

  async create(contact: UserContact, type: NotificationType, payload: NotificationPayload): Promise<Notification> {
    const created: Notification = {
      id: uuid(),
      contact: contact.id,
      type,
      payload,
      status: NotificationStatus.new,
      createdAt: new Date(),
    };

    await this.table().insert(created);

    return created;
  }

  async markAsProcessed(notification: Notification): Promise<Notification> {
    let updated = {
      ...notification,
      status: NotificationStatus.processed,
      processedAt: new Date(),
    };

    await this.table().update(updated);

    return updated;
  }
}


export class UserContactService {
  constructor(
      readonly table: Factory<UserContactTable> = table,
  ) {}

  async create(user: User, type: ContactBroker, address: string): Promise<UserContact> {
    const duplicates = await this.table().where({
      user: user.id,
      type,
      address,
    });
    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: UserContact = {
      id: uuid(),
      user: user.id,
      type,
      address,
      status: ContactStatus.Inactive,
      confirmationCode: uuid(),
      createdAt: new Date(),
    };

    await this.table().insert(created);

    return created;
  }

  async activate(contact: UserContact): Promise<UserContact> {
    const activated: UserContact = {
      ...contact,
      status: ContactStatus.Active,
      activatedAt: new Date(),
    };

    await this.table().update(activated);

    return activated;
  }

  async delete(contact: UserContact): Promise<void> {
    await this.table().delete(contact.id);
  }
}

export class UserEventSubscriptionService {
  constructor(
      readonly table: Factory<UserEventSubscriptionTable> = table,
  ) {}

  async create(contact: UserContact, webHook: ContractEventWebHook): Promise<UserEventSubscription> {
    const duplicates = await this.table().where({
      contact: contact.id,
      webHook: webHook.id,
    });

    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: UserEventSubscription = {
      id: uuid(),
      contact: contact.id,
      webHook: webHook.id,
      createdAt: new Date(),
    };

    await this.table().insert(created);

    return created;
  }

  async delete(subscription: UserEventSubscription): Promise<void> {
    await this.table().delete(subscription.id);
  }
}

export class ContractEventWebHookService {
  constructor(
      readonly table: Factory<ContractEventWebHookTable> = table,
  ) {}

  async create(contract: Contract, event: string): Promise<ContractEventWebHook> {
    const duplicates = await this.table().where({
      contract: contract.id,
      event: event,
    });

    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: ContractEventWebHook = {
      id: uuid(),
      contract: contract.id,
      event,
      createdAt: new Date(),
    };

    await this.table().insert(created);

    // TODO: Добавить в очередь задачу на подписку в сканере

    return created;
  }
}