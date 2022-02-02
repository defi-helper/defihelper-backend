import { Process } from '@models/Queue/Entity';
import container from '@container';
import { walletBlockchainTableName, walletTableName } from '@models/Wallet/Entity';

interface Event {
  address: string;
  from: string;
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
      const blockchainWallet = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .where({
          blockchain: contract.blockchain,
          network: contract.network,
          address: contract.blockchain === 'ethereum' ? event.from.toLowerCase() : event.from,
        })
        .first();
      if (!blockchainWallet) return;

      await container.model.contractService().walletLink(contract, blockchainWallet);
    }),
  );

  return process.done();
};
