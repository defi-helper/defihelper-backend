import container from '@container';
import { contractTableName } from '@models/Protocol/Entity';
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
    const database = container.database();
    const map = new Map(
      await container
        .database()
        .column('protocol')
        .sum('v AS v')
        .from(
          container.model
            .metricContractTable()
            .distinctOn(`${metricContractTableName}.contract`)
            .column(`${contractTableName}.protocol`)
            .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS v`))
            .innerJoin(
              contractTableName,
              `${contractTableName}.id`,
              `${metricContractTableName}.contract`,
            )
            .whereIn(`${contractTableName}.protocol`, protocolsId)
            .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
            .orderBy(`${metricContractTableName}.contract`)
            .orderBy(`${metricContractTableName}.date`, 'DESC')
            .as('metric'),
        )
        .groupBy('protocol')
        .then((rows) => rows.map(({ protocol, v }) => [protocol, v])),
    );

    return protocolsId.map((id) => map.get(id) ?? '0');
  });

export const protocolUserLastMetricLoader = ({
  userId,
  metric,
}: {
  userId: string;
  metric: MetricWalletField;
}) =>
  new DataLoader<string, string>(async (protocolsId) => {
    const database = container.database();
    const map = new Map(
      await container
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
            .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
            .whereIn(`${contractTableName}.protocol`, protocolsId)
            .andWhere(`${walletTableName}.user`, userId)
            .andWhere(database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`))
            .orderBy(`${metricWalletTableName}.contract`)
            .orderBy(`${metricWalletTableName}.date`, 'DESC')
            .as('metric'),
        )
        .groupBy('protocol')
        .then((rows) => rows.map(({ protocol, v }) => [protocol, v])),
    );

    return protocolsId.map((id) => map.get(id) ?? '0');
  });

export const protocolUserLastAPRLoader = ({
  userId,
  metric,
}: {
  userId: string;
  metric: MetricContractAPRField;
}) =>
  new DataLoader<string, string>(async (protocolsId) => {
    const database = container.database();
    const aprMap = await container.model
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
      .then((rows) =>
        rows.reduce(
          (map, { protocol, contract, apr }) => ({
            ...map,
            [protocol]: {
              ...(map[protocol] ?? {}),
              [contract]: apr,
            },
          }),
          {} as { [protocol: string]: { [contract: string]: string } },
        ),
      );
    const stakedMap = await container.model
      .metricWalletTable()
      .distinctOn(`${metricWalletTableName}.contract`)
      .column(`${metricWalletTableName}.contract`)
      .column(`${contractTableName}.protocol`)
      .column(database.raw(`(${metricWalletTableName}.data->>'stakingUSD')::numeric AS staked`))
      .innerJoin(contractTableName, `${contractTableName}.id`, `${metricWalletTableName}.contract`)
      .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
      .whereIn(`${contractTableName}.protocol`, protocolsId)
      .andWhere(`${walletTableName}.user`, userId)
      .andWhere(database.raw(`${metricWalletTableName}.data->>'stakingUSD' IS NOT NULL`))
      .orderBy(`${metricWalletTableName}.contract`)
      .orderBy(`${metricWalletTableName}.date`, 'DESC')
      .then((rows) =>
        rows.reduce(
          (map, { protocol, contract, staked }) => ({
            ...map,
            [protocol]: {
              ...(map[protocol] ?? {}),
              [contract]: staked,
            },
          }),
          {} as { [protocol: string]: { [contract: string]: string } },
        ),
      );

    return protocolsId.map((protocolId) => {
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
      if (sum.staked.eq(0)) return '0';

      return sum.earned.div(sum.staked).toString(10);
    });
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
