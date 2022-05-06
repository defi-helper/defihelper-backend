import container from '@container';
import {
  Contract,
  contractBlockchainTableName,
  ContractBlockchainType,
  contractTableName,
} from '@models/Protocol/Entity';
import {
  MetricContract,
  MetricContractAPRField,
  MetricContractField,
  metricContractTableName,
  metricWalletTableName,
} from '@models/Metric/Entity';
import {
  walletBlockchainTableName,
  WalletBlockchainType,
  walletTableName,
} from '@models/Wallet/Entity';
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
      (result, { key, value }) =>
        value !== null ? { ...result, [key]: JSON.parse(value) } : result,
      {},
    );
  }

  async setMap(keys: ReadonlyArray<string>, valuesMap: { [k: string]: string | Object }) {
    return Promise.all(
      keys.map(
        (key) =>
          new Promise((resolve, reject) =>
            this.cache.set(
              `${this.prefix}:${key}`,
              JSON.stringify(valuesMap[key] ?? null),
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
    let subselect;
    if (metric === 'uniqueWalletsCount') {
      subselect = container.model
        .metricContractTable()
        .distinctOn(`${metricContractTableName}.contract`)
        .column(`${contractTableName}.protocol`)
        .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS v`))
        .innerJoin(
          contractTableName,
          `${contractTableName}.id`,
          `${metricContractTableName}.contract`,
        )
        .whereIn(`${contractTableName}.protocol`, notCachedIds)
        .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
        .orderBy(`${metricContractTableName}.contract`)
        .orderBy(`${metricContractTableName}.date`, 'DESC');
    } else {
      subselect = container.model
        .contractTable()
        .innerJoin(
          contractBlockchainTableName,
          `${contractBlockchainTableName}.id`,
          `${contractTableName}.id`,
        )
        .column(`${contractTableName}.protocol`)
        .column(database.raw(`(${contractBlockchainTableName}.metric->>'${metric}')::numeric AS v`))
        .whereIn(`${contractTableName}.protocol`, notCachedIds)
        .andWhere(database.raw(`${contractBlockchainTableName}.metric->>'${metric}' IS NOT NULL`));
    }
    const metrics =
      notCachedIds.length > 0
        ? await container
            .database()
            .column('protocol')
            .sum('v AS v')
            .from(subselect.as('metric'))
            .groupBy('protocol')
        : [];
    const map = metrics.reduce(
      (result, { protocol, v }) => ({ ...result, [protocol]: v }),
      cachedMap,
    );
    await cache.setMap(notCachedIds, map);

    return protocolsId.map((id) => map[id] ?? '0');
  });

export const protocolUserLastMetricLoader = ({ userId }: { userId: string }) =>
  new DataLoader<string, { stakingUSD: string; earnedUSD: string; minUpdatedAt: string | null }>(
    async (protocolsId) => {
      const cache = new Cache(`defihelper:dataLoader:protocolUserLastMetric:${userId}`, 1800);
      const cachedMap = await cache.getMap(protocolsId);

      const database = container.database();
      const notCachedIds = protocolsId.filter((protocolId) => cachedMap[protocolId] === undefined);
      const metrics =
        notCachedIds.length > 0
          ? await container
              .database()
              .column('protocol')
              .sum('stakingUSD AS stakingUSD')
              .sum('earnedUSD AS earnedUSD')
              .min('date AS minUpdatedAt')
              .from(
                container.model
                  .metricWalletTable()
                  .distinctOn(
                    `${metricWalletTableName}.contract`,
                    `${metricWalletTableName}.wallet`,
                  )
                  .column(`${contractTableName}.protocol`)
                  .column(
                    database.raw(
                      `(${metricWalletTableName}.data->>'stakingUSD')::numeric AS "stakingUSD"`,
                    ),
                  )
                  .column(
                    database.raw(
                      `(${metricWalletTableName}.data->>'earnedUSD')::numeric AS "earnedUSD"`,
                    ),
                  )
                  .column(`${metricWalletTableName}.date AS date`)
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
                  .whereNull(`${walletTableName}.deletedAt`)
                  .orderBy(`${metricWalletTableName}.contract`)
                  .orderBy(`${metricWalletTableName}.wallet`)
                  .orderBy(`${metricWalletTableName}.date`, 'DESC')
                  .as('metric'),
              )
              .groupBy('protocol')
          : [];
      const map = metrics.reduce(
        (result, { protocol, stakingUSD, earnedUSD, minUpdatedAt }) => ({
          ...result,
          [protocol]: {
            stakingUSD: stakingUSD ?? '0',
            earnedUSD: earnedUSD ?? '0',
            minUpdatedAt: minUpdatedAt ? minUpdatedAt.toISOString() : null,
          },
        }),
        cachedMap,
      );
      await cache.setMap(notCachedIds, map);

      return protocolsId.map(
        (id) => map[id] ?? { stakingUSD: '0', earnedUSD: '0', minUpdatedAt: null },
      );
    },
  );

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
            .contractTable()
            .innerJoin(
              contractBlockchainTableName,
              `${contractBlockchainTableName}.id`,
              `${contractTableName}.id`,
            )
            .column(`${contractTableName}.id`)
            .column(`${contractTableName}.protocol`)
            .column(
              database.raw(`(${contractBlockchainTableName}.metric->>'${metric}')::numeric AS apr`),
            )
            .whereIn(`${contractTableName}.protocol`, protocolsId)
            .andWhere(
              database.raw(`${contractBlockchainTableName}.metric->>'${metric}' IS NOT NULL`),
            )
        : [];
    const aprMap = aprMetrics.reduce(
      (map, { protocol, id: contract, apr }) => ({
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
            .whereNull(`${walletTableName}.deletedAt`)
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
  new DataLoader<string, (Contract & ContractBlockchainType) | null>(async (contractsId) => {
    const map = await container.model
      .contractTable()
      .innerJoin(
        contractBlockchainTableName,
        `${contractBlockchainTableName}.id`,
        `${contractTableName}.id`,
      )
      .whereIn(`${contractTableName}.id`, contractsId)
      .then((rows) => new Map(rows.map((contract) => [contract.id, contract])));

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const contractLastMetricLoader = () =>
  new DataLoader<string, MetricContract | null>(async (contractsId) => {
    const map = await container.model
      .metricContractTable()
      .distinctOn(`${metricContractTableName}.contract`)
      .column(`${metricContractTableName}.*`)
      .whereIn(`${metricContractTableName}.contract`, contractsId)
      .orderBy(`${metricContractTableName}.contract`)
      .orderBy(`${metricContractTableName}.date`, 'DESC')
      .then((rows) => new Map(rows.map((row) => [row.contract, row])));

    return contractsId.map((id) => map.get(id) ?? null);
  });

export const contractUserLastMetricLoader = ({
  userId,
  walletType,
}: {
  userId: string;
  walletType: WalletBlockchainType[];
}) =>
  new DataLoader<string, { stakingUSD: string; earnedUSD: string }>(async (contractsId) => {
    const database = container.database();
    const map = await container
      .database()
      .column('contract')
      .sum('stakingUSD AS stakingUSD')
      .sum('earnedUSD AS earnedUSD')
      .from(
        container.model
          .metricWalletTable()
          .distinctOn(`${metricWalletTableName}.contract`, `${metricWalletTableName}.wallet`)
          .column(`${metricWalletTableName}.contract`)
          .column(
            database.raw(`(${metricWalletTableName}.data->>'stakingUSD')::numeric AS "stakingUSD"`),
          )
          .column(
            database.raw(`(${metricWalletTableName}.data->>'earnedUSD')::numeric AS "earnedUSD"`),
          )
          .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
          .innerJoin(
            walletBlockchainTableName,
            `${walletTableName}.id`,
            `${walletBlockchainTableName}.id`,
          )
          .where(function () {
            this.where(`${walletTableName}.user`, userId)
              .whereNull(`${walletTableName}.deletedAt`)
              .whereIn(`${walletBlockchainTableName}.type`, walletType);
          })
          .orderBy(`${metricWalletTableName}.contract`)
          .orderBy(`${metricWalletTableName}.wallet`)
          .orderBy(`${metricWalletTableName}.date`, 'DESC')
          .as('metric'),
      )
      .groupBy('contract')
      .then(
        (rows) =>
          new Map(
            rows.map(({ contract, stakingUSD, earnedUSD }) => [
              contract,
              { stakingUSD, earnedUSD },
            ]),
          ),
      );

    return contractsId.map((id) => map.get(id) ?? { stakingUSD: '0', earnedUSD: '0' });
  });
