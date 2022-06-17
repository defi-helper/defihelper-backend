import { Process } from '@models/Queue/Entity';
import container from '@container';
import dayjs from 'dayjs';
import {
  contractBlockchainTableName,
  contractTableName,
  MetadataType,
} from '@models/Protocol/Entity';
import * as Scanner from '@services/Scanner';

export interface ContractRegisterParams {
  contract: string;
  events?: string[];
}

export default async (process: Process) => {
  const { contract: contractId, events: eventsToSubscribe } = process.task
    .params as ContractRegisterParams;

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
  const { deployBlockNumber } = contract;
  if (deployBlockNumber === null) {
    throw new Error('Contract deploy block number is not resolved');
  }

  const scanner = container.scanner();
  try {
    const contractFromScanner = await scanner.getContractByFid(contract.id);

    if (!contractFromScanner) {
      const servedAbi = await container.model
        .metadataTable()
        .where({
          blockchain: contract.blockchain,
          network: contract.network,
          address: contract.address,
          type: MetadataType.EthereumContractAbi,
        })
        .first();

      if (!servedAbi) {
        await container.model.queueService().push('contractResolveAbi', {
          id: contract.id,
        });
        return process
          .later(dayjs().add(5, 'minutes').toDate())
          .info('postponed due to abi resolving');
      }
      if (servedAbi.value.value === null) {
        return process.done().info(`served abi contains wrong payload: ${servedAbi.id}`);
      }

      await scanner.registerContract(
        contract.network,
        contract.address,
        servedAbi.value.value,
        contract.name,
        deployBlockNumber,
        contract.id,
      );

      return process
        .later(dayjs().add(1, 'minutes').toDate())
        .info('postponed due to awaiting registering contract');
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

    await Promise.all(events.map((event) => scanner.registerListener(contractFromScanner, event)));
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
