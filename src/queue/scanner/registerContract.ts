import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import {
  Contract,
  contractBlockchainTableName,
  ContractBlockchainType,
  contractTableName,
  MetadataType,
} from '@models/Protocol/Entity';

async function registerWatcherContract(contract: Contract & ContractBlockchainType, ABI: object) {
  const { deployBlockNumber } = contract;
  if (deployBlockNumber === null) {
    throw new Error('Contract deploy block number is not resolved');
  }

  const scanner = container.scanner();
  let watcherContract = contract.watcherId ? await scanner.getContract(contract.watcherId) : null;
  if (watcherContract === null) {
    watcherContract = await scanner.registerContract(
      contract.network,
      contract.address,
      ABI,
      contract.name,
      deployBlockNumber,
    );
    await container.model.contractService().updateBlockchain({
      ...contract,
      watcherId: watcherContract.id,
    });
  }

  return watcherContract;
}

const defaultEvents = ['Approval', 'Deposit'];

export interface ContractRegisterParams {
  contract: string;
  events?: string[];
}

export default async (process: Process) => {
  const { contract: contractId } = process.task.params as ContractRegisterParams;
  let { events: eventsToSubscribe } = process.task.params as ContractRegisterParams;

  const contract = await container.model
    .contractTable()
    .innerJoin(
      contractBlockchainTableName,
      `${contractBlockchainTableName}.id`,
      `${contractTableName}.id`,
    )
    .where(`${contractTableName}.id`, contractId)
    .first();
  if (!contract) {
    throw new Error('Contract is not found');
  }

  // Resolve ABI
  const metadataABI = await container.model
    .metadataTable()
    .where({
      blockchain: contract.blockchain,
      network: contract.network,
      address: contract.address,
      type: MetadataType.EthereumContractAbi,
    })
    .first();
  if (!metadataABI) {
    await container.model.queueService().push('contractResolveAbi', {
      id: contract.id,
    });
    return process.later(dayjs().add(5, 'minutes').toDate()).info('postponed due to abi resolving');
  }
  if (metadataABI.value.value === null) {
    throw new Error(`served abi contains wrong payload: ${metadataABI.id}`);
  }

  // Events listeners list
  if (!eventsToSubscribe || eventsToSubscribe.length === 0) {
    eventsToSubscribe = defaultEvents;
  }
  const events: string[] = metadataABI.value.value
    .filter(
      ({ type, name }: { type: string; name: string }) =>
        type === 'event' && (!eventsToSubscribe || eventsToSubscribe.includes(name)),
    )
    .map(({ name }: { name: string }) => name);
  if (events.length === 0) {
    throw new Error('Events to subscribe not founds');
  }

  // Watcher contract
  const watcherContract = await registerWatcherContract(contract, metadataABI.value.value);

  // Watcher listeners
  const scanner = container.scanner();
  await Promise.all(
    events.map((event) =>
      scanner.registerListener(watcherContract, event, {
        historical: { syncHeight: watcherContract.startHeight, saveEvents: false },
      }),
    ),
  );

  return process.done();
};
