import { Factory } from '@services/Container';
import {
  ContactBroker,
  ContactStatus,
  ContractEventWebHook,
  ContractEventWebHookTable,
  Notification,
  NotificationStatus,
  NotificationTable,
  NotificationType,
  UserContact,
  UserContactTable,
  UserEventSubscription,
  UserEventSubscriptionTable
} from './Entity';
import { v4 as uuid } from "uuid";
import { User } from "@models/User/Entity";
import { Contract } from "@models/Protocol/Entity";
import container from "@container";
import {Emitter} from "@services/Event";

export class NotificationService {
  constructor(
    readonly table: Factory<NotificationTable> = table,
  ) {}

  public readonly onCreated = new Emitter<Notification>(async (notification) => {
    switch (notification.type) {
      case NotificationType.event:
        await container.model.queueService().push('subscribeToEventFromScanner', notification);
        return;
      default:
        container.logger().error(`Unsupported notification type ${notification.type}`);
    }
  });

  async create(contact: UserContact, type: NotificationType, payload: Object): Promise<Notification> {
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
      readonly externalSelfUrl: string,
  ) {}

  public readonly onCreated = new Emitter<UserContact>(async (contact) => {
    if (contact.type === ContactBroker.Email) {
      await container.model.queueService().push('sendEmail', {
        email: contact.address,
        template: 'confirmEmailTemplate',
        subject: 'Please confirm your email',
        params: {
          confirmationLink: `${this.externalSelfUrl}/verification/${contact.address}/${contact.confirmationCode}`,
        },
      });
    }
  });


  async create(type: ContactBroker, address: string, user: User): Promise<UserContact> {
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

    this.onCreated.emit({...created});
    created.confirmationCode = '';;

    return created;
  }

  async activate(contact: UserContact, address?: string): Promise<UserContact> {
    const activated: UserContact = {
      ...contact,
      address: address || contact.address,
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
    const duplicate = await this.table().where({
      contact: contact.id,
      webHook: webHook.id,
    }).first()

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
    await this.table().delete(subscription.id);
  }
}

interface ContractEventWebHookInfo {
  network: string;
  address: string;
  event: string;
  webHookId: string,
}

export class ContractEventWebHookService {
  constructor(
      readonly table: Factory<ContractEventWebHookTable> = table,
  ) {}

  public readonly onCreated = new Emitter<ContractEventWebHookInfo>(async (webHookInfo) => {
    await container.model.queueService().push('subscribeToEventFromScanner', webHookInfo);
  });

  async create(contract: Contract, event: string): Promise<ContractEventWebHook> {
    const duplicate = await this.table().where({
      contract: contract.id,
      event: event,
    }).first()

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
      event: event,
      webHookId: created.id,
    });

    return created;
  }
}