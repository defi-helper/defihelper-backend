import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import * as Scanner from '@services/Scanner';

export interface ScannerSubscriptionParams {
  network: string;
  address: string;
  event: string;
  webHookId: string;
}

export default async (process: Process) => {
  const subscriptionParams = process.task.params as ScannerSubscriptionParams;

  const callBackUrl = `${container.parent.api.internalUrl}/callback/event/${subscriptionParams.webHookId}?secret=${container.parent.api.secret}`;

  try {
    await container
      .scanner()
      .registerCallback(
        subscriptionParams.network,
        subscriptionParams.address,
        subscriptionParams.event,
        callBackUrl,
      );
  } catch (e) {
    if (e instanceof Scanner.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }
  }

  return process.done();
};
