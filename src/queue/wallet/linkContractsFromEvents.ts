import { Process } from '@models/Queue/Entity';
import container from '@container';

interface Event {
  address: string;
  blockNumber: number;
  blockHash: string;
  transactionIndex: number;
  transactionHash: string;
  logIndex: number;
  args: Object;
  createdAt: Date;
}

export interface EventNotificationParams {
  events: Event[];
  eventName: string;
  webHookId: string;
}

export default async (process: Process) => {
  const eventNotificationParams = process.task.params as EventNotificationParams;

  const webHook = await container.model
    .contractEventWebHookTable()
    .where('id', eventNotificationParams.webHookId)
    .first();

  if (!webHook) {
    throw new Error(`WebHook is not found ${eventNotificationParams.webHookId}`);
  }

  const contract = await container.model.contractTable().where('id', webHook.contract).first();
  if (!contract) {
    throw new Error(`Contract ${webHook.contract} is not found for WebHook ${webHook.contract}`);
  }

  await Promise.all(
    eventNotificationParams.events.map(async (event) => {
      const wallet = await container.model
        .walletTable()
        .where({
          blockchain: contract.blockchain,
          network: contract.network,
          address: event.address,
        })
        .first();

      if (!wallet) {
        return;
      }

      await container.model.contractService().walletLink(contract, wallet);
    }),
  );

  return process.done();
};
