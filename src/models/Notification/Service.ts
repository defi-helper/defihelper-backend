import { Factory } from '@services/Container';
import { v4 as uuid } from 'uuid';
import { User } from '@models/User/Entity';
import { Contract, ContractBlockchain } from '@models/Protocol/Entity';
import container from '@container';
import { Emitter } from '@services/Event';
import {
  ContactBroker,
  ContactStatus,
  ContractEventWebHook,
  ContractEventWebHookTable,
  Notification,
  NotificationPayloadType,
  NotificationStatus,
  NotificationTable,
  UserContact,
  UserContactParams,
  UserContactTable,
  UserEventSubscription,
  UserEventSubscriptionTable,
} from './Entity';

export class NotificationService {
  constructor(readonly table: Factory<NotificationTable>) {}

  public readonly onCreated = new Emitter<Notification>(async (notification) => {
    return container.model.queueService().push('notificationSend', { id: notification.id });
  });

  async create(contact: UserContact, payload: NotificationPayloadType): Promise<Notification> {
    const created: Notification = {
      id: uuid(),
      contact: contact.id,
      ...payload,
      status: NotificationStatus.new,
      createdAt: new Date(),
    };

    await this.table().insert(created);
    this.onCreated.emit(created);

    return created;
  }

  async markAsProcessed(notification: Notification): Promise<Notification> {
    const updated = {
      ...notification,
      status: NotificationStatus.processed,
      processedAt: new Date(),
    };

    await this.table().where('id', notification.id).update(updated);

    return updated;
  }
}

export class UserContactService {
  constructor(readonly table: Factory<UserContactTable>, readonly externalSelfUrl: string) {}

  public readonly onCreated = new Emitter<{ user: User; contact: UserContact }>(
    async ({ user, contact }) => {
      if (contact.broker === ContactBroker.Email) {
        await container.model.queueService().push('sendEmail', {
          email: contact.address,
          template: 'confirmEmailTemplate',
          subject: 'Please confirm your email',
          params: {
            confirmationCode: contact.confirmationCode,
          },
          locale: user.locale,
        });
      }
    },
  );

  async create(
    broker: ContactBroker,
    rawAddress: string,
    user: User,
    name: string,
  ): Promise<UserContact> {
    let address = rawAddress;
    if (broker === ContactBroker.Telegram) {
      address = address.indexOf('@') === -1 ? address.slice(1) : address;
    } else {
      address = address.toLowerCase();
    }

    const duplicates = await this.table().where({
      user: user.id,
      broker,
      address,
    });
    if (duplicates.length > 0) {
      return duplicates[0];
    }

    const created: UserContact = {
      id: uuid(),
      user: user.id,
      broker,
      address,
      name,
      status: ContactStatus.Inactive,
      confirmationCode: uuid(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.table().insert(created);

    this.onCreated.emit({ user, contact: created });

    return created;
  }

  async update(contact: UserContact) {
    const updated = {
      ...contact,
      updatedAt: new Date(),
    };
    await this.table().where({ id: contact.id }).update(updated);

    return updated;
  }

  async activate(
    contact: UserContact,
    address?: string,
    params?: UserContactParams,
  ): Promise<UserContact> {
    if (contact.status === ContactStatus.Active) {
      return contact;
    }

    const activated: UserContact = {
      ...contact,
      params: params || contact.params,
      confirmationCode: '',
      address: address || contact.address,
      status: ContactStatus.Active,
      activatedAt: new Date(),
    };

    await this.table()
      .where({
        id: activated.id,
      })
      .update(activated);

    return activated;
  }

  async delete(contact: UserContact): Promise<void> {
    await this.table()
      .where({
        id: contact.id,
      })
      .delete();
  }
}

export class UserEventSubscriptionService {
  constructor(readonly table: Factory<UserEventSubscriptionTable>) {}

  async create(
    contact: UserContact,
    webHook: ContractEventWebHook,
  ): Promise<UserEventSubscription> {
    const duplicate = await this.table()
      .where({
        contact: contact.id,
        webHook: webHook.id,
      })
      .first();

    if (duplicate) {
      return duplicate;
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
    await this.table()
      .where({
        id: subscription.id,
      })
      .delete();
  }
}

interface ContractEventWebHookInfo {
  network: string;
  address: string;
  event: string;
  webHookId: string;
}

export class ContractEventWebHookService {
  constructor(readonly table: Factory<ContractEventWebHookTable>) {}

  public readonly onCreated = new Emitter<ContractEventWebHookInfo>(async (webHookInfo) => {
    await container.model.queueService().push('subscribeToEventFromScanner', webHookInfo);
  });

  async create(
    contract: Contract & ContractBlockchain,
    event: string,
  ): Promise<ContractEventWebHook> {
    const duplicate = await this.table()
      .where({
        contract: contract.id,
        event,
      })
      .first();

    if (duplicate) {
      return duplicate;
    }

    const created: ContractEventWebHook = {
      id: uuid(),
      contract: contract.id,
      event,
      createdAt: new Date(),
    };

    await this.table().insert(created);

    this.onCreated.emit({
      network: contract.network,
      address: contract.address,
      event,
      webHookId: created.id,
    });

    return created;
  }
}
