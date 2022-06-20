import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import * as Watcher from '@services/Watcher';

export interface WatcherSubscriptionParams {
  network: string;
  address: string;
  event: string;
  webHookId: string;
}

export default async (process: Process) => {
  const subscriptionParams = process.task.params as WatcherSubscriptionParams;

  const callBackUrl = `${container.parent.api.internalUrl}/callback/event/${subscriptionParams.webHookId}?secret=${container.parent.api.secret}`;

  try {
    await container
      .watcher()
      .registerCallback(
        subscriptionParams.network,
        subscriptionParams.address,
        subscriptionParams.event,
        callBackUrl,
      );
  } catch (e) {
    if (e instanceof Watcher.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

  return process.done();
};
