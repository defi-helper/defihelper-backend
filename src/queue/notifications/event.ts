import { Process } from "@models/Queue/Entity";
import container from "@container";
import {ContactBroker, NotificationStatus, NotificationType} from "@models/Notification/Entity";
import {EventUrls} from "./webHook";

export interface EventNotificationParams {
  id: string;
  contact: string;
  type: NotificationType;
  payload: { eventsUrls: EventUrls[], eventName: string, contractAddress: string, network: number };
  status: NotificationStatus;
  createdAt: Date;
  processedAt?: Date;
}

const networkIdToString = (network: number) => {
  switch (network) {
    case 1:
      return 'Ethereum'
    case 56:
      return 'BSC'
    default:
      return '';
  }
}

export default async (process: Process) => {
  const notification = process.task.params as EventNotificationParams;

  try {
    const errors: string[] = [];
    const contact = await container.model.userContactTable()
        .where('id', notification.contact)
        .first();

    if (contact) {
      const params = {
        eventName: notification.payload.eventName,
        eventsUrls: notification.payload.eventsUrls,
        contractAddress: notification.payload.contractAddress,
        network: networkIdToString(notification.payload.network),
      };

      switch (contact.type) {
        case ContactBroker.Email:
          await container.model.queueService().push('sendEmail', params);
          break;
        case ContactBroker.Telegram:
          await container.model.queueService().push('sendTelegram', params);
          break;
        default:
          errors.push(`Contact broker is not found ${contact.type}`);
      }
    } else {
      errors.push(`Contact is not found ${notification.contact} for notification ${notification.id}`);
    }
    if (errors.length > 0) {
      return process.error(new Error(errors.join('; ')));
    }
    return process.done();
  } finally {
    await container.model.notificationService().markAsProcessed(notification);
  }
};
