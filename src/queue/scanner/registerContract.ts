import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import { MetadataType } from '@models/Protocol/Entity';

export interface ContractRegisterParams {
  contract: string;
  events?: string[];
}

export default async (process: Process) => {
  const { contract: contractId, events: eventsToSubscribe } = process.task
    .params as ContractRegisterParams;

  const contract = await container.model.contractTable().where('id', contractId).first();
  if (!contract) {
    throw new Error('Contract is not found');
  }

  const deployBlockNumber =
    contract.deployBlockNumber === null ? undefined : parseInt(contract.deployBlockNumber, 10);

  const contractFromScanner = await container
    .scanner()
    .findContract(contract.network, contract.address);

  if (!contractFromScanner) {
    const servedAbi = await container.model
      .metadataTable()
      .where({
        contract: contract.id,
        type: MetadataType.EthereumContractAbi,
      })
      .first();

    if (!servedAbi) {
      await container.model.queueService().push('contractResolveAbi', {
        id: contract.id,
      });
      return process.later(dayjs().add(5, 'minutes').toDate());
    }
    if (servedAbi.value.value === null) {
      return process.done();
    }

    await container
      .scanner()
      .registerContract(
        contract.network,
        contract.address,
        contract.name,
        servedAbi.value.value,
        deployBlockNumber,
      );

    return process.later(dayjs().add(1, 'minutes').toDate());
  }

  if (eventsToSubscribe && eventsToSubscribe.length === 0) {
    return process.done();
  }

  const events: string[] = contractFromScanner.abi
    .filter(
      ({ type, name }: any) =>
        type === 'event' && (!eventsToSubscribe || eventsToSubscribe.includes(name)),
    )
    .map(({ name }: any) => name);

  await Promise.all(
    events.map(async (event) => {
      await container.scanner().registerListener(contractFromScanner.id, event, deployBlockNumber);
      await container.model.contractEventWebHookService().create(contract, event);
    }),
  );

  return process.done();
};
