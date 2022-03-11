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
  events: string[];
}

export interface Pool {
  name: string;
  address: string;
  deployBlockNumber: number;
  blockchain: Blockchain;
  network: string;
  layout: 'staking';
  adapter: string;
  description: string;
  automate: {
    adapters: string[];
    autorestakeAdapter?: string | undefined;
  };
  link: string;
}

export default async (process: Process) => {
  const { protocolId, protocolBlockchain, protocolNetwork, events } = process.task.params as Params;

  const protocol = await container.model.protocolTable().where('id', protocolId).first();
  if (!protocol) throw new Error('Protocol not found');

  let protocolDefaultResolver;
  try {
    // todo introduce type
    const protocolAdapters: any = await container.blockchainAdapter.loadAdapter(protocol.adapter);

    if (
      !protocolAdapters.automates ||
      !protocolAdapters.automates.contractsResolver ||
      !protocolAdapters.automates.contractsResolver.default
    ) {
      throw new Error('Adapter have no pools resolver, u should implement it first');
    }

    protocolDefaultResolver = protocolAdapters.automates.contractsResolver.default;
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

  const pools: Pool[] = await protocolDefaultResolver(network.provider(), {
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
  await Promise.all(
    pools.map(async (pool) => {
      const duplicate = existingPools.find(
        (p) =>
          p.address.toLowerCase() === pool.address.toLowerCase() &&
          p.network === pool.network &&
          p.blockchain === pool.blockchain,
      );
      if (duplicate) {
        await Promise.all([
          container.model
            .queueService()
            .push('registerContractInScanner', { contract: duplicate.id, events }),

          contractService.updateBlockchain({
            ...duplicate,
            automate: pool.automate,
          }),
        ]);
      }

      await container.model
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
          {},
          pool.name,
          pool.description,
          pool.link,
          true,
          events,
        );
    }),
  );

  return process.done();
};
