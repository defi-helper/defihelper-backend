import container from '@container';
import { Process } from '@models/Queue/Entity';
import { NotificationType } from '@models/Notification/Entity';

interface WebHook {
  address: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  transactionHash: string;
  logIndex: number;
  args: Object;
  createdAt: Date;
}

interface Contract {
  id: string;
  address: string;
  network: number;
  name: string;
  startHeight: number;
  updatedAt: Date;
  createdAt: Date;
}

export interface EventNotificationParams {
  events: WebHook[];
  contract: Contract;
  eventName: string;
  webHookId: string;
}

export interface EventUrls {
  link: string;
  txHash: string;
}

const getExplorer = (network: number) => {
  switch (network) {
    case 1:
      return 'https://etherscan.io/tx/';
    case 56:
      return 'https://bscscan.com/tx/';
    default:
      return '';
  }
};

export default async (process: Process) => {
  const eventNotificationParams = process.task.params as EventNotificationParams;

  const subscriptions = await container.model
    .userEventSubscriptionTable()
    .where('webHook', eventNotificationParams.webHookId);

  const explorerUrl = getExplorer(eventNotificationParams.contract.network);
  if (!explorerUrl) {
    container
      .logger()
      .error(`Explorer is not found for network ${eventNotificationParams.contract.network}`);
    return process.done();
  }

  const eventsUrls: EventUrls[] = eventNotificationParams.events.map((event) => ({
    link: `${explorerUrl}/${event.transactionHash}`,
    txHash: event.transactionHash,
  }));

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const contact = await container.model
        .userContactTable()
        .where('id', subscription.contact)
        .first();
      if (!contact) return;

      await container.model.notificationService().create(contact, NotificationType.event, {
        eventsUrls,
        eventName: eventNotificationParams.eventName,
        contractAddress: eventNotificationParams.contract.address,
        network: eventNotificationParams.contract.network,
      });
    }),
  );

  return process.done();
};
