import { Process } from '@models/Queue/Entity';
import axios from 'axios';
import container from '@container';

const protocolName = 'swop.fi';
const adapterName = 'swopfi';
const protocolDescription = 'Swop.fi LP farming';

const stakingAdapterName = 'farming';

interface SwopFiPool {
  pool: string;
  shareToken: string;
}

interface SwopFiAsset {
  id: string;
  name: string;
}

export default async (process: Process) => {
  let protocol = await container.model.protocolTable().where('name', protocolName).first();

  if (!protocol) {
    protocol = await container.model
      .protocolService()
      .create(adapterName, protocolName, protocolDescription, null, null, null, {}, false);
  }
  const contracts = await container.model.contractTable().where('protocol', protocol.id).select();
  const pools = (await axios.get<{ data: SwopFiPool[] }>(`https://backend.swop.fi/farming/info`))
    .data.data;
  const assets = (
    await axios.get<{ data: { [key: string]: SwopFiAsset } }>(`https://backend.swop.fi/assets`)
  ).data.data;

  const newPools = pools.filter((pool) => !contracts.some((c) => c.address === pool.pool));
  const removedContracts = contracts.filter(
    (contract) => !pools.some((p) => contract.address === p.pool),
  );

  await Promise.all(
    newPools.map(async (pool) => {
      if (!protocol) {
        return;
      }

      const token = assets[pool.shareToken];
      if (!token) {
        return;
      }

      const contract = await container.model
        .contractTable()
        .where({
          protocol: protocol.id,
          blockchain: 'waves',
          network: 'main',
          address: pool.pool,
        })
        .first();

      if (!contract) {
        await container.model
          .contractService()
          .create(
            protocol,
            'waves',
            'main',
            pool.pool,
            null,
            stakingAdapterName,
            '',
            { adapters: [] },
            `Staking ${token.name}`,
            '',
            `https://swop.fi/info/${pool.pool}`,
            false,
            [],
          );
      }
    }),
  );

  await Promise.all(
    removedContracts.map(async (contract) => {
      if (!protocol) {
        return;
      }

      await container.model
        .contractTable()
        .update({
          hidden: true,
        })
        .where('id', contract.id);
    }),
  );

  return process.done();
};
