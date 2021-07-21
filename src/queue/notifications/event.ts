import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, NotificationStatus, NotificationType } from '@models/Notification/Entity';
import { EventUrls } from './webHook';

export interface EventNotificationParams {
  id: string;
  contact: string;
  type: NotificationType;
  payload: { eventsUrls: EventUrls[]; eventName: string; contractAddress: string; network: number };
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
}

const networkIdToString = (network: number) => {
  switch (network) {
    case 1:
      return 'Ethereum';
    case 56:
      return 'BSC';
    default:
      return '';
  }
};

export default async (process: Process) => {
  const notification = process.task.params as EventNotificationParams;

  try {
    const contact = await container.model
      .userContactTable()
      .where('id', notification.contact)
      .first();
    if (!contact) {
      throw new Error(
        `Contact is not found ${notification.contact} for notification ${notification.id}`,
      );
    }
    const user = await container.model.userTable().where('id', contact.user).first();
    if (!user) {
      throw new Error('User own contact not found');
    }

    const params = {
      eventName: notification.payload.eventName,
      eventsUrls: notification.payload.eventsUrls,
      contractAddress: notification.payload.contractAddress,
      network: networkIdToString(notification.payload.network),
    };

    switch (contact.broker) {
      case ContactBroker.Email:
        await container.model.queueService().push('sendEmail', {
          email: contact.address,
          template: 'eventTemplate',
          subject: 'Event',
          params,
          locale: user.locale,
        });
        break;
      case ContactBroker.Telegram:
        await container.model.queueService().push('sendTelegram', {
          chatId: contact.params?.chatId || 0,
          template: 'eventTemplate',
          params,
          locale: user.locale,
        });
        break;
      default:
        throw new Error(`Contact broker is not found ${contact.broker}`);
    }

    return process.done();
  } finally {
    await container.model.notificationService().markAsProcessed(notification);
  }
};
