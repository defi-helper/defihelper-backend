import container from '@container';
import { Contract, contractTableName } from '@models/Protocol/Entity';
import {
  metricContractTableName,
  metricWalletTableName,
  MetricContractField,
  MetricWalletField,
  MetricContractAPRField,
} from '@models/Metric/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import BN from 'bignumber.js';
import DataLoader from 'dataloader';

class Cache {
  public readonly cache = container.cache();

  constructor(public readonly prefix: string, public readonly ttl: number) {}

  async getMap(keys: ReadonlyArray<string>) {
    const cached = await Promise.all(
      keys.map(
        (key) =>
          new Promise<{ key: string; value: string | null }>((resolve, reject) =>
            this.cache.get(`${this.prefix}:${key}`, (err, value) =>
              err ? reject(err) : resolve({ key, value }),
            ),
          ),
      ),
    );
    return cached.reduce<{ [protocolId: string]: string }>(
      (result, { key, value }) => (value !== null ? { ...result, [key]: value } : result),
      {},
    );
  }

  async setMap(keys: ReadonlyArray<string>, valuesMap: { [k: string]: string }) {
    return Promise.all(
      keys.map(
        (key) =>
          new Promise((resolve, reject) =>
            this.cache.set(
              `${this.prefix}:${key}`,
              valuesMap[key] ?? '0',
              'EX',
              this.ttl,
              (err, data) => (err ? reject(err) : resolve(data)),
            ),
          ),
      ),
    );
  }
}

export const protocolFavoritesLoader = ({ userId }: { userId: string }) =>
  new DataLoader<string, boolean>(async (protocolsId) => {
    const favoritesSet = new Set(
      await container.model
        .protocolUserFavoriteTable()
        .where('user', userId)
        .whereIn('protocol', protocolsId)
        .then((favorites) => favorites.map(({ protocol }) => protocol)),
    );

    return protocolsId.map((protocolId) => favoritesSet.has(protocolId));
  });

export const protocolLastMetricLoader = ({ metric }: { metric: MetricContractField }) =>
  new DataLoader<string, string>(async (protocolsId) => {
    const cache = new Cache(`defihelper:dataLoader:protocolLastMetric:${metric}`, 1800);
    const cachedMap = await cache.getMap(protocolsId);

    const database = container.database();
    const notCachedIds = protocolsId.filter((protocolId) => cachedMap[protocolId] === undefined);
    const metrics =
      notCachedIds.length > 0
        ? await container
            .database()
            .column('protocol')
            .sum('v AS v')
            .from(
              container.model
                .metricContractTable()
                .distinctOn(`${metricContractTableName}.contract`)
                .column(`${contractTableName}.protocol`)
                .column(
                  database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS v`),
                )
                .innerJoin(
                  contractTableName,
                  `${contractTableName}.id`,
                  `${metricContractTableName}.contract`,
                )
                .whereIn(`${contractTableName}.protocol`, notCachedIds)
                .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
                .orderBy(`${metricContractTableName}.contract`)
                .orderBy(`${metricContractTableName}.date`, 'DESC')
                .as('metric'),
            )
            .groupBy('protocol')
        : [];
    const map = metrics.reduce(
      (result, { protocol, v }) => ({ ...result, [protocol]: v }),
      cachedMap,
    );
    await cache.setMap(notCachedIds, map);

    return protocolsId.map((id) => map[id] ?? '0');
  });

export const protocolUserLastMetricLoader = ({
  userId,
  metric,
}: {
  userId: string;
  metric: MetricWalletField;
}) =>
  new DataLoader<string, string>(async (protocolsId) => {
    const cache = new Cache(
      `defihelper:dataLoader:protocolUserLastMetric:${userId}-${metric}`,
      1800,
    );
    const cachedMap = await cache.getMap(protocolsId);

    const database = container.database();
    const notCachedIds = protocolsId.filter((protocolId) => cachedMap[protocolId] === undefined);
    const metrics =
      notCachedIds.length > 0
        ? await container
            .database()
            .column('protocol')
            .sum('v AS v')
            .from(
              container.model
                .metricWalletTable()
                .distinctOn(`${metricWalletTableName}.contract`)
                .column(`${contractTableName}.protocol`)
                .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS v`))
                .innerJoin(
                  contractTableName,
                  `${contractTableName}.id`,
                  `${metricWalletTableName}.contract`,
                )
                .innerJoin(
                  walletTableName,
                  `${walletTableName}.id`,
                  `${metricWalletTableName}.wallet`,
                )
                .whereIn(`${contractTableName}.protocol`, protocolsId)
                .andWhere(`${walletTableName}.user`, userId)
                .andWhere(database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`))
                .orderBy(`${metricWalletTableName}.contract`)
                .orderBy(`${metricWalletTableName}.date`, 'DESC')
                .as('metric'),
            )
            .groupBy('protocol')
        : [];
    const map = metrics.reduce(
      (result, { protocol, v }) => ({ ...result, [protocol]: v }),
      cachedMap,
    );
    await cache.setMap(notCachedIds, map);

    return protocolsId.map((id) => map[id] ?? '0');
  });

export const protocolUserLastAPRLoader = ({
  userId,
  metric,
}: {
  userId: string;
  metric: MetricContractAPRField;
}) =>
  new DataLoader<string, string>(async (protocolsId) => {
    const cache = new Cache(
      `defihelper:dataLoader:protocolUserLastAPRMetric:${userId}-${metric}`,
      1800,
    );
    const cachedMap = await cache.getMap(protocolsId);

    const database = container.database();
    const notCachedIds = protocolsId.filter((protocolId) => cachedMap[protocolId] === undefined);
    const aprMetrics =
      notCachedIds.length > 0
        ? await container.model
            .metricContractTable()
            .distinctOn(`${metricContractTableName}.contract`)
            .column(`${metricContractTableName}.contract`)
            .column(`${contractTableName}.protocol`)
            .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS apr`))
            .innerJoin(
              contractTableName,
              `${contractTableName}.id`,
              `${metricContractTableName}.contract`,
            )
            .whereIn(`${contractTableName}.protocol`, protocolsId)
            .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
            .orderBy(`${metricContractTableName}.contract`)
            .orderBy(`${metricContractTableName}.date`, 'DESC')
        : [];
    const aprMap = aprMetrics.reduce(
      (map, { protocol, contract, apr }) => ({
        ...map,
        [protocol]: {
          ...(map[protocol] ?? {}),
          [contract]: apr,
        },
      }),
      {} as { [protocol: string]: { [contract: string]: string } },
    );
    const stakedMetric =
      notCachedIds.length > 0
        ? await container.model
            .metricWalletTable()
            .distinctOn(`${metricWalletTableName}.contract`)
            .column(`${metricWalletTableName}.contract`)
            .column(`${contractTableName}.protocol`)
            .column(
              database.raw(`(${metricWalletTableName}.data->>'stakingUSD')::numeric AS staked`),
            )
            .innerJoin(
              contractTableName,
              `${contractTableName}.id`,
              `${metricWalletTableName}.contract`,
            )
            .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
            .whereIn(`${contractTableName}.protocol`, protocolsId)
            .andWhere(`${walletTableName}.user`, userId)
            .andWhere(database.raw(`${metricWalletTableName}.data->>'stakingUSD' IS NOT NULL`))
            .orderBy(`${metricWalletTableName}.contract`)
            .orderBy(`${metricWalletTableName}.date`, 'DESC')
        : [];
    const stakedMap = stakedMetric.reduce(
      (map, { protocol, contract, staked }) => ({
        ...map,
        [protocol]: {
          ...(map[protocol] ?? {}),
          [contract]: staked,
        },
      }),
      {} as { [protocol: string]: { [contract: string]: string } },
    );

    const map = notCachedIds.reduce((result, protocolId) => {
      const protocolStaked = stakedMap[protocolId] ?? {};
      const protocolAPR = aprMap[protocolId] ?? {};
      const sum = Object.keys(protocolStaked).reduce(
        ({ earned, staked }, contract) => {
          const contractStaked = protocolStaked[contract] ?? '0';
          const contractAPR = protocolAPR[contract] ?? '0';

          return {
            earned: earned.plus(new BN(contractStaked).multipliedBy(contractAPR)),
            staked: staked.plus(contractStaked),
          };
        },
        { earned: new BN(0), staked: new BN(0) },
      );

      return {
        ...result,
        [protocolId]: sum.staked.eq(0) ? '0' : sum.earned.div(sum.staked).toString(10),
      };
    }, cachedMap);
    await cache.setMap(notCachedIds, map);

    return protocolsId.map((id) => map[id] ?? '0');
  });

export const contractLoader = () =>
  new DataLoader<string, Contract | null>(async (contractsId) => {
    const map = new Map(
      await container.model
        .contractTable()
        .whereIn('id', contractsId)
        .then((rows) => rows.map((contract) => [contract.id, contract])),
    );

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const contractLastMetricLoader = ({ metric }: { metric: MetricContractField }) =>
  new DataLoader<string, string>(async (contractsId) => {
    const database = container.database();
    const map = new Map(
      await container.model
        .metricContractTable()
        .distinctOn(`${metricContractTableName}.contract`)
        .column(`${metricContractTableName}.contract`)
        .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS v`))
        .whereIn(`${metricContractTableName}.contract`, contractsId)
        .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
        .orderBy(`${metricContractTableName}.contract`)
        .orderBy(`${metricContractTableName}.date`, 'DESC')
        .then((rows) => rows.map(({ contract, v }) => [contract, v])),
    );

    return contractsId.map((id) => map.get(id) ?? '0');
  });

export const contractUserLastMetricLoader = ({
  userId,
  metric,
}: {
  userId: string;
  metric: MetricWalletField;
}) =>
  new DataLoader<string, string>(async (contractsId) => {
    const database = container.database();
    const map = new Map(
      await container.model
        .metricWalletTable()
        .distinctOn(`${metricWalletTableName}.contract`)
        .column(`${metricWalletTableName}.contract`)
        .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS v`))
        .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
        .andWhere(`${walletTableName}.user`, userId)
        .andWhere(database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`))
        .orderBy(`${metricWalletTableName}.contract`)
        .orderBy(`${metricWalletTableName}.date`, 'DESC')
        .then((rows) => rows.map(({ contract, v }) => [contract, v])),
    );

    return contractsId.map((id) => map.get(id) ?? '0');
  });
