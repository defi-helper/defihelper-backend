import { Process } from '@models/Queue/Entity';
import container from '@container';

export interface ScannerSubscriptionParams {
  network: string;
  address: string;
  event: string;
  webHookId: string;
}

export default async (process: Process) => {
  const subscriptionParams = process.task.params as ScannerSubscriptionParams;

  const callBackUrl = `${container.parent.api.internalUrl}:${container.parent.api.port}/callback/event/:webHookId${subscriptionParams.webHookId}?secret=${container.parent.api.secret}`;

  await container
    .scanner()
    .registerCallback(
      subscriptionParams.network,
      subscriptionParams.address,
      subscriptionParams.event,
      callBackUrl,
    );

  return process.done();
};
