import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { MetadataType } from '@models/Protocol/Entity';
import * as Watcher from '@services/Watcher';
import { TriggerType } from '@models/Automate/Entity';

export interface ContractRegisterParams {
  trigger: string;
}

export default async (process: Process) => {
  const { trigger: triggerId } = process.task.params as ContractRegisterParams;

  const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
  if (!trigger) {
    throw new Error('trigger not found');
  }

  if (trigger.type !== TriggerType.ContractEvent) {
    throw new Error('Invalid trigger type');
  }

  const { network, address, event: eventToSubscribe } = trigger.params;
  const servedAbi = await container.model
    .metadataTable()
    .where({
      blockchain: 'ethereum',
      network,
      address,
      type: MetadataType.EthereumContractAbi,
    })
    .first();

  if (!servedAbi) {
    throw new Error('Abi not found');
  }

  try {
    const contractFromWatcher = await container.watcher().findContract(network, address);
    if (!contractFromWatcher) {
      await container.watcher().registerContract(network, address, servedAbi.value?.value);
      return process.later(dayjs().add(1, 'minutes').toDate());
    }

    const callback = await container
      .watcher()
      .registerCallback(
        network,
        address,
        eventToSubscribe,
        `${container.parent.api.internalUrl}/callback/trigger/${trigger.id}?secret=${container.parent.api.secret}`,
      );

    await container.model.automateService().updateTrigger({
      ...trigger,
      params: {
        ...trigger.params,
        callback: callback.id,
      },
    });
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
