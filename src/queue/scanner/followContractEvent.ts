import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { MetadataType } from '@models/Protocol/Entity';
import * as Scanner from '@services/Scanner';

export interface ContractRegisterParams {
  address: string;
  network: string;
  event: string;
  triggerId: string;
}

export default async (process: Process) => {
  const {
    address,
    network,
    event: eventToSubscribe,
    triggerId,
  } = process.task.params as ContractRegisterParams;

  const trigger = await container.model.automateTriggerTable().where('id', triggerId).first();
  const servedAbi = await container.model
    .metadataTable()
    .where({
      blockchain: 'ethereum',
      network,
      address,
      type: MetadataType.EthereumContractAbi,
    })
    .first();

  if (!servedAbi || !trigger) {
    throw new Error('Abi or trigger not found');
  }

  try {
    const contractFromScanner = await container.scanner().findContract(network, address);
    if (!contractFromScanner) {
      await container.scanner().registerContract(network, address, servedAbi.value?.value);
      return process.later(dayjs().add(1, 'minutes').toDate());
    }

    await container.scanner().registerListener(contractFromScanner.id, eventToSubscribe);

    const callback = await container
      .scanner()
      .registerCallback(
        network,
        address,
        eventToSubscribe,
        `${container.parent.api.internalUrl}/callback/trigger/${trigger.id}?secret=${container.parent.api.secret}`,
      );

    await container.model.automateService().updateTrigger({
      ...trigger,
      params: {
        ...{
          ...trigger.params,
          network,
          address,
          event: eventToSubscribe,
        },
        callback: callback.id,
      },
    });
  } catch (e) {
    if (e instanceof Scanner.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

  return process.done();
};
