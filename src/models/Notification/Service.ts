import {Factory} from '@services/Container';
import {
  Contact,
  ContactBroker,
  ContactStatus,
  ContactTable,
  Notification,
  NotificationPayload,
  NotificationStatus,
  NotificationTable,
  NotificationType,
  Subscription,
  SubscriptionTable,
  WebHook,
  WebHookTable
} from './Entity';
import {v4 as uuid} from "uuid";
import {User} from "@models/User/Entity";
import {Contract} from "@models/Protocol/Entity";

export class NotificationService {
  constructor(
    readonly table: Factory<NotificationTable> = table,
  ) {}

  async create(contact: Contact, type: NotificationType, payload: NotificationPayload): Promise<Notification> {
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


export class ContactService {
  constructor(
      readonly table: Factory<ContactTable> = table,
  ) {}


  async find(user: User, type?: ContactBroker, address?: string): Promise<Contact[]> {
    return this.table().where({
      user: user.id,
      ...(type ? { type } : {}),
      ...(address ? { address } : {}),
    });
  }

  async create(user: User, type: ContactBroker, address: string): Promise<Contact> {
    const duplicates = await this.find(user, type, address);
    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: Contact = {
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

  async activate(contact: Contact): Promise<Contact> {
    const activated: Contact = {
      ...contact,
      status: ContactStatus.Active,
      activatedAt: new Date(),
    };

    await this.table().update(activated);

    return activated;
  }

  async delete(contact: Contact): Promise<void> {
    await this.table().delete(contact.id);
  }
}

export class SubscriptionService {
  constructor(
      readonly table: Factory<SubscriptionTable> = table,
  ) {}

  async findByUser(user: User): Promise<Subscription[]> {
    return this.table().where({
      user: user.id,
    });
  }

  async findByWebHook(webHook: WebHook): Promise<Subscription[]> {
    return this.table().where({
      webHook: webHook.id,
    });
  }

  async create(contact: Contact, webHook: WebHook): Promise<Subscription> {
    const duplicates = await this.table().where({
      contact: contact.id,
      webHook: webHook.id,
    });

    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: Subscription = {
      id: uuid(),
      user: contact.user,
      contact: contact.id,
      webHook: webHook.id,
      createdAt: new Date(),
    };

    await this.table().insert(created);

    return created;
  }

  async delete(subscription: Subscription): Promise<void> {
    await this.table().delete(subscription.id);
  }
}

export class WebHookService {
  constructor(
      readonly table: Factory<WebHookTable> = table,
  ) {}

  async create(contract: Contract, event: string): Promise<WebHook> {
    const duplicates = await this.table().where({
      contract: contract.id,
      event: event,
    });

    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: WebHook = {
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