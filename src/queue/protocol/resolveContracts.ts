import container from '@container';
import { Process } from '@models/Queue/Entity';
import { Blockchain } from '@models/types';
import * as Adapters from '@services/Blockchain/Adapter';
import dayjs from 'dayjs';
import { contractBlockchainTableName, contractTableName } from '@models/Protocol/Entity';

export interface Params {
  protocolId: string;
  protocolBlockchain: Blockchain;
  protocolNetwork: string;
  resolver: string;
  events: string[];
}

export default async (process: Process) => {
  const { protocolId, protocolBlockchain, protocolNetwork, events, resolver } = process.task
    .params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  let protocolDefaultResolver;
  try {
    const protocolAdapters = await container.blockchainAdapter.loadAdapter(protocol.adapter);

    if (
      !protocolAdapters.automates ||
      !protocolAdapters.automates.contractsResolver ||
      !protocolAdapters.automates.contractsResolver[resolver]
    ) {
      throw new Error('Adapter have no pools resolver, u should implement it first');
    }

    protocolDefaultResolver = protocolAdapters.automates.contractsResolver[resolver];
  } catch (e) {
    if (e instanceof Adapters.TemporaryOutOfService) {
      return process
        .info('postponed due to temporarily service unavailability')
        .later(dayjs().add(5, 'minute').toDate());
    }

    throw e;
  }

  const blockchain = container.blockchain[protocolBlockchain];
  const network = blockchain.byNetwork(protocolNetwork);

  try {
    const pools = await protocolDefaultResolver(network.provider(), {
      cacheAuth: container.parent.adapters.auth,
    });

    const existingPools = await container.model
      .contractTable()
      .innerJoin(
        contractBlockchainTableName,
        `${contractBlockchainTableName}.id`,
        `${contractTableName}.id`,
      )
      .where({
        protocol: protocolId,
      });

    const contractService = container.model.contractService();
    const queue = container.model.queueService();
    await pools.reduce<Promise<unknown>>(async (prev, pool) => {
      await prev;

      const duplicate = existingPools.find(
        (p) =>
          p.address.toLowerCase() === pool.address.toLowerCase() &&
          p.network === pool.network &&
          p.blockchain === pool.blockchain &&
          p.adapter === pool.adapter,
      );
      if (duplicate) {
        if (duplicate.watcherId === null) {
          await queue.push('registerContractInScanner', { contract: duplicate.id, events });
        }
        return contractService.updateBlockchain({
          ...duplicate,
          automate: pool.automate,
        });
      }

      return container.model
        .contractService()
        .createBlockchain(
          protocol,
          protocolBlockchain,
          protocolNetwork,
          pool.address.toLowerCase(),
          null,
          pool.adapter,
          pool.layout,
          pool.automate,
          pool.name,
          pool.description,
          pool.link,
          true,
          events,
        );
    }, Promise.resolve(null));

    return process.done();
  } catch (e) {
    if ((process.task.attempt ?? 0) < 5) {
      return process.later(
        dayjs()
          .add(Math.floor(Math.random() * 5) + 1, 'minutes')
          .toDate(),
      );
    }

    throw e;
  }
};
