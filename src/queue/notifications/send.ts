import { Process } from '@models/Queue/Entity';
import container from '@container';
import { ContactBroker, NotificationType } from '@models/Notification/Entity';

export interface Params {
  id: string;
}

const networkNameById = (network: string) => {
  if (container.blockchain.ethereum.isNetwork(network)) {
    return container.blockchain.ethereum.byNetwork(network).name;
  }

  return '';
};

export default async (process: Process) => {
  const { id } = process.task.params as Params;
  const notification = await container.model.notificationTable().where('id', id).first();
  if (!notification) throw new Error('Notification not found');

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
      throw new Error('Contact owner not found');
    }

    let sendParams = {};
    switch (notification.type) {
      case NotificationType.event:
        sendParams = {
          subject: 'Event',
          params: {
            eventName: notification.payload.eventName,
            eventsUrls: notification.payload.eventsUrls,
            contractName: notification.payload.contractName,
            contractUrl: notification.payload.contractUrl,
            network: networkNameById(notification.payload.network.toString()),
          },
          template: 'eventTemplate',
        };
        break;
      case NotificationType.trigger:
        sendParams = {
          subject: 'Trigger run',
          params: notification.payload,
          template: 'triggerTemplate',
        };
        break;
      default:
        throw new Error('Invalid notification type');
    }

    switch (contact.broker) {
      case ContactBroker.Email:
        await container.model.queueService().push('sendEmail', {
          email: contact.address,
          locale: user.locale,
          ...sendParams,
        });
        break;
      case ContactBroker.Telegram:
        await container.model.queueService().push('sendTelegram', {
          chatId: contact.params?.chatId || 0,
          locale: user.locale,
          ...sendParams,
        });
        break;
      default:
        throw new Error(`Contact broker is not found ${contact.broker}`);
    }
  } finally {
    await container.model.notificationService().markAsProcessed(notification);
  }

  return process.done();
};
