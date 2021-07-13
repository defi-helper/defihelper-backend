import { Process } from "@models/Queue/Entity";
import container from "@container";
import {ContactBroker, NotificationType} from "@models/Notification/Entity";
import {Blockchain} from "@models/types";
import {throws} from "assert";

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
  events: WebHook[],
  contract: Contract;
  eventName: string;
  webHookId: string;
}

export interface EventUrls {
  link: string;
  txHash: string;
}

const getExplorer = (blockchain: Blockchain, network: string) => {
  switch (blockchain) {
    case 'ethereum':
      try {
        return `${container.blockchain.ethereum.explorerUrlByNetwork(network)}/tx`;
      } catch {
        return '';
      }
    case 'waves':
      return 'https://wavesexplorer.com/tx/'
    default:
      return '';
  }
};

export default async (process: Process) => {
  const eventNotificationParams = process.task.params as EventNotificationParams;

  const webHook = await container.model.contractEventWebHookTable()
      .where('id', eventNotificationParams.webHookId)
      .first();

  if (!webHook) {
    throw new Error(`WebHook is not found ${eventNotificationParams.webHookId}`);
  }

  const contract = await container.model.contractTable().where('id', webHook.contract).first();
  if (!contract) {
    throw new Error(`Contract ${webHook.contract} is not found for WebHook ${webHook.contract}`);
  }

  const subscriptions = await container.model.userEventSubscriptionTable()
    .where('webHook', eventNotificationParams.webHookId);

  const explorerUrl = getExplorer(contract.blockchain, contract.network);
  if (!explorerUrl) {
    throw new Error(`Explorer is not found for network ${eventNotificationParams.contract.network}`);
  }

  const eventsUrls: EventUrls[] = eventNotificationParams.events
    .map(event => ({ link: `${explorerUrl}/${event.transactionHash}`, txHash: event.transactionHash }))

  for (const subscription of subscriptions) {
    const contact = await container.model.userContactTable()
      .where('id', subscription.contact)
      .first();
    if (contact) {
      await container.model.notificationService().create(contact, NotificationType.event, {
        eventsUrls,
        eventName: eventNotificationParams.eventName,
        contractAddress: eventNotificationParams.contract.address,
        network: eventNotificationParams.contract.network,
      });
    }
  }

  return process.done();
};
