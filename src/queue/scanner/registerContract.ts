import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';

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

  if (eventsToSubscribe && eventsToSubscribe.length === 0) {
    return process.done();
  }

  const deployBlockNumber =
    contract.deployBlockNumber === null ? undefined : parseInt(contract.deployBlockNumber, 10);
  const contractFromScanner = await container
    .scanner()
    .findContract(contract.network, contract.address);
  if (!contractFromScanner || !contractFromScanner.abi) {
    await container
      .scanner()
      .registerContract(contract.network, contract.address, contract.name, deployBlockNumber);
    return process.later(dayjs().add(1, 'minutes').toDate());
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
