import container from '@container';
import BN from 'bignumber.js';
import {
  metricWalletTableName,
  MetricWalletField,
  metricContractTableName,
  MetricContractAPRField,
} from '@models/Metric/Entity';
import { walletContractLinkTableName } from '@models/Protocol/Entity';
import { tableName as walletTableName } from '@models/Wallet/Entity';
import DataLoader from 'dataloader';

export const userBlockchainLoader = () =>
  new DataLoader(async (usersId: ReadonlyArray<string>) => {
    const blockchains = await container.model
      .walletTable()
      .columns('user', 'blockchain', 'network')
      .whereIn('user', usersId)
      .groupBy('user', 'blockchain', 'network');

    return usersId.map((userId) => blockchains.filter(({ user }) => user === userId));
  });

export const userLastMetricLoader = ({ metric }: { metric: MetricWalletField }) =>
  new DataLoader(async (usersId: ReadonlyArray<string>) => {
    const database = container.database();
    const map = new Map(
      await container
        .database()
        .column('user')
        .sum('v AS v')
        .from(
          container.model
            .metricWalletTable()
            .distinctOn(`${metricWalletTableName}.wallet`)
            .column(`${walletTableName}.user`)
            .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS v`))
            .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
            .whereIn(`${walletTableName}.user`, usersId)
            .andWhere(database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`))
            .orderBy(`${metricWalletTableName}.wallet`)
            .orderBy(`${metricWalletTableName}.date`, 'DESC')
            .as('metric'),
        )
        .groupBy('user')
        .then((rows) => rows.map(({ user, v }) => [user, v])),
    );

    return usersId.map((id) => map.get(id) ?? '0');
  });

export const userLastAPRLoader = ({ metric }: { metric: MetricContractAPRField }) =>
  new DataLoader<string, string>(async (usersId) => {
    const database = container.database();
    const contractsId = await container.model
      .walletContractLinkTable()
      .distinct(`${walletContractLinkTableName}.contract`)
      .innerJoin(walletTableName, `${walletTableName}.id`, `${walletContractLinkTableName}.wallet`)
      .whereIn(`${walletTableName}.user`, usersId)
      .then((rows) => rows.map(({ contract }) => contract));
    const aprMap = await container.model
      .metricContractTable()
      .distinctOn(`${metricContractTableName}.contract`)
      .column(`${metricContractTableName}.contract`)
      .column(database.raw(`(${metricContractTableName}.data->>'${metric}')::numeric AS apr`))
      .whereIn(`${metricContractTableName}.contract`, contractsId)
      .andWhere(database.raw(`${metricContractTableName}.data->>'${metric}' IS NOT NULL`))
      .orderBy(`${metricContractTableName}.contract`)
      .orderBy(`${metricContractTableName}.date`, 'DESC')
      .then((rows) =>
        rows.reduce(
          (map, { contract, apr }) => ({
            ...map,
            [contract]: apr,
          }),
          {} as { [contract: string]: string },
        ),
      );
    const stakedMap = await container
      .database()
      .column('user')
      .column('contract')
      .sum('v AS staked')
      .from(
        container.model
          .metricWalletTable()
          .distinctOn(`${walletTableName}.user`, `${metricWalletTableName}.contract`)
          .column(`${walletTableName}.user`)
          .column(`${metricWalletTableName}.contract`)
          .column(database.raw(`(${metricWalletTableName}.data->>'stakingUSD')::numeric AS v`))
          .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
          .whereIn(`${walletTableName}.user`, usersId)
          .andWhere(database.raw(`${metricWalletTableName}.data->>'stakingUSD' IS NOT NULL`))
          .orderBy(`${walletTableName}.user`)
          .orderBy(`${metricWalletTableName}.contract`)
          .orderBy(`${metricWalletTableName}.date`, 'DESC')
          .as('metric'),
      )
      .groupBy('user')
      .groupBy('contract')
      .then((rows) =>
        rows.reduce(
          (map, { user, contract, staked }) => ({
            ...map,
            [user]: {
              ...(map[user] ?? {}),
              [contract]: staked,
            },
          }),
          {} as { [user: string]: { [contract: string]: string } },
        ),
      );

    return usersId.map((userId) => {
      const userStaked = stakedMap[userId] ?? {};
      const sum = Object.keys(userStaked).reduce(
        ({ earned, staked }, contract) => {
          const contractStaked = userStaked[contract] ?? '0';
          const contractAPR = aprMap[contract] ?? '0';

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
