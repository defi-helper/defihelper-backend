import container from '@container';
import BN from 'bignumber.js';
import {
  metricContractTableName,
  MetricContractAPRField,
  metricWalletRegistryTableName,
  metricWalletTokenRegistryTableName,
  QueryModify,
  RegistryPeriod,
  MetricWalletRegistry,
} from '@models/Metric/Entity';
import { User } from '@models/User/Entity';
import { walletContractLinkTableName } from '@models/Protocol/Entity';
import {
  Wallet,
  WalletBlockchain,
  walletBlockchainTableName,
  walletTableName,
} from '@models/Wallet/Entity';
import DataLoader from 'dataloader';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';
import { contractTableName, triggerTableName } from '@models/Automate/Entity';
import dayjs from 'dayjs';

export const userLoader = () =>
  new DataLoader<string, User | null>(async (usersId) => {
    const map = await container.model
      .userTable()
      .whereIn('id', usersId)
      .then((rows) => new Map(rows.map((user) => [user.id, user])));
    return usersId.map((userId) => map.get(userId) ?? null);
  });

export const userBlockchainLoader = () =>
  new DataLoader<string, Array<Pick<Wallet & WalletBlockchain, 'user' | 'blockchain' | 'network'>>>(
    async (usersId) => {
      const blockchains = await container.model
        .walletTable()
        .innerJoin(
          walletBlockchainTableName,
          `${walletBlockchainTableName}.id`,
          `${walletTableName}.id`,
        )
        .columns(
          `${walletTableName}.user`,
          `${walletBlockchainTableName}.blockchain`,
          `${walletBlockchainTableName}.network`,
        )
        .whereIn(`${walletTableName}.user`, usersId)
        .whereNull(`${walletTableName}.deletedAt`)
        .groupBy(
          `${walletTableName}.user`,
          `${walletBlockchainTableName}.blockchain`,
          `${walletBlockchainTableName}.network`,
        );

      return usersId.map((userId) => blockchains.filter(({ user }) => user === userId));
    },
  );

export const userLastMetricLoader = () =>
  new DataLoader<
    string,
    {
      stakingUSD: string;
      stakingUSDDayBefore: string;
      earnedUSD: string;
      earnedUSDDayBefore: string;
    }
  >(async (usersId) => {
    const select = container.model
      .metricWalletRegistryTable()
      .column(`${walletTableName}.user`)
      .innerJoin(
        walletTableName,
        `${walletTableName}.id`,
        `${metricWalletRegistryTableName}.wallet`,
      )
      .whereIn(`${walletTableName}.user`, usersId)
      .whereNull(`${walletTableName}.deletedAt`)
      .groupBy('user');
    const [latestMap, dayBeforeMap] = await Promise.all([
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'stakingUSD',
          `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
        ])
        .modify(QueryModify.sumMetric, [
          'earnedUSD',
          `${metricWalletRegistryTableName}.data->>'earnedUSD'`,
        ])
        .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
        .whereBetween(`${metricWalletRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().add(1, 'day').startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              user: string;
              stakingUSD: string;
              earnedUSD: string;
            }>,
          ) =>
            new Map(
              rows.map(({ user, stakingUSD, earnedUSD }) => [
                user,
                {
                  stakingUSD,
                  earnedUSD,
                },
              ]),
            ),
        ),
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'stakingUSDDayBefore',
          `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
        ])
        .modify(QueryModify.sumMetric, [
          'earnedUSDDayBefore',
          `${metricWalletRegistryTableName}.data->>'earnedUSD'`,
        ])
        .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Day)
        .whereBetween(`${metricWalletRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              user: string;
              stakingUSDDayBefore: string;
              earnedUSDDayBefore: string;
            }>,
          ) =>
            new Map(
              rows.map(({ user, stakingUSDDayBefore, earnedUSDDayBefore }) => [
                user,
                {
                  stakingUSDDayBefore,
                  earnedUSDDayBefore,
                },
              ]),
            ),
        ),
    ]);

    return usersId.map((id) => {
      const latest = latestMap.get(id) ?? {
        stakingUSD: '0',
        earnedUSD: '0',
      };
      const dayBefore = dayBeforeMap.get(id) ?? {
        stakingUSDDayBefore: '0',
        earnedUSDDayBefore: '0',
      };
      return { ...latest, ...dayBefore };
    });
  });

export const userLastAPRLoader = ({ metric }: { metric: MetricContractAPRField }) =>
  new DataLoader<string, string>(async (usersId) => {
    const database = container.database();
    const contractsId = await container.model
      .walletContractLinkTable()
      .distinct(`${walletContractLinkTableName}.contract`)
      .innerJoin(walletTableName, `${walletTableName}.id`, `${walletContractLinkTableName}.wallet`)
      .whereIn(`${walletTableName}.user`, usersId)
      .whereNull(`${walletTableName}.deletedAt`)
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
    const stakedMap = await container.model
      .metricWalletRegistryTable()
      .column(`${walletTableName}.user`)
      .column(`${metricWalletRegistryTableName}.contract`)
      .column(
        database.raw(
          `SUM((COALESCE(${metricWalletRegistryTableName}.data->>'stakingUSD', '0'))::numeric) AS staked`,
        ),
      )
      .innerJoin(
        walletTableName,
        `${walletTableName}.id`,
        `${metricWalletRegistryTableName}.wallet`,
      )
      .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
      .whereIn(`${walletTableName}.user`, usersId)
      .whereNull(`${walletTableName}.deletedAt`)
      .whereBetween(`${metricWalletRegistryTableName}.date`, [
        dayjs().add(-1, 'day').startOf('day').toDate(),
        dayjs().add(1, 'day').startOf('day').toDate(),
      ])
      .groupBy('user', 'contract')
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

export const userTokenLastMetricLoader = ({
  contract,
  tokenAlias,
}: {
  contract?: { id?: string[] } | null;
  tokenAlias?: { liquidity?: TokenAliasLiquidity[] };
}) =>
  new DataLoader<
    string,
    {
      usd: string;
      usdDayBefore: string;
    }
  >(async (usersId) => {
    const select = container.model
      .metricWalletTokenRegistryTable()
      .column(`${walletTableName}.user`)
      .innerJoin(
        walletTableName,
        `${walletTableName}.id`,
        `${metricWalletTokenRegistryTableName}.wallet`,
      )
      .whereIn(`${walletTableName}.user`, usersId)
      .whereNull(`${walletTableName}.deletedAt`)
      .where(function () {
        if (typeof contract === 'object') {
          if (contract !== null) {
            if (Array.isArray(contract.id)) {
              this.whereIn(`${metricWalletTokenRegistryTableName}.contract`, contract.id);
            }
          } else {
            this.whereNull(`${metricWalletTokenRegistryTableName}.contract`);
          }
        }
      })
      .groupBy(`${walletTableName}.user`);
    if (typeof tokenAlias === 'object') {
      select
        .innerJoin(
          tokenTableName,
          `${tokenTableName}.id`,
          `${metricWalletTokenRegistryTableName}.token`,
        )
        .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
        .where(function () {
          if (Array.isArray(tokenAlias.liquidity) && tokenAlias.liquidity.length > 0) {
            this.whereIn(`${tokenAliasTableName}.liquidity`, tokenAlias.liquidity);
          }
        });
    }
    const [latestMap, dayBeforeMap] = await Promise.all([
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'usd',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().add(1, 'day').startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              user: string;
              usd: string;
            }>,
          ) => new Map(rows.map(({ user, usd }) => [user, { usd }])),
        ),
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'usdDayBefore',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Day)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              user: string;
              usdDayBefore: string;
            }>,
          ) => new Map(rows.map(({ user, usdDayBefore }) => [user, { usdDayBefore }])),
        ),
    ]);

    return usersId.map((id) => {
      const latest = latestMap.get(id) ?? {
        usd: '0',
      };
      const dayBefore = dayBeforeMap.get(id) ?? {
        usdDayBefore: '0',
      };
      return { ...latest, ...dayBefore };
    });
  });

export const walletLoader = () =>
  new DataLoader<string, (Wallet & WalletBlockchain) | null>(async (walletsId) => {
    const map = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .whereIn(`${walletTableName}.id`, walletsId)
      .then((rows) => new Map(rows.map((wallet) => [wallet.id, wallet])));

    return walletsId.map((id) => map.get(id) ?? null);
  });

export const walletLastMetricLoader = () =>
  new DataLoader<
    string,
    {
      stakingUSD: string;
      stakingUSDDayBefore: string;
      earnedUSD: string;
      earnedUSDDayBefore: string;
    }
  >(async (walletsId) => {
    const select = container.model
      .metricWalletRegistryTable()
      .column(`${metricWalletRegistryTableName}.wallet`)
      .whereIn(`${metricWalletRegistryTableName}.wallet`, walletsId)
      .groupBy(`${metricWalletRegistryTableName}.wallet`);

    const [latestMap, dayBeforeMap] = await Promise.all([
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'stakingUSD',
          `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
        ])
        .modify(QueryModify.sumMetric, [
          'earnedUSD',
          `${metricWalletRegistryTableName}.data->>'earnedUSD'`,
        ])
        .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Latest)
        .whereBetween(`${metricWalletRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().add(1, 'day').startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              wallet: string;
              stakingUSD: string;
              earnedUSD: string;
            }>,
          ) =>
            new Map(
              rows.map(({ wallet, stakingUSD, earnedUSD }) => [
                wallet,
                {
                  stakingUSD,
                  earnedUSD,
                },
              ]),
            ),
        ),
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'stakingUSDDayBefore',
          `${metricWalletRegistryTableName}.data->>'stakingUSD'`,
        ])
        .modify(QueryModify.sumMetric, [
          'earnedUSDDayBefore',
          `${metricWalletRegistryTableName}.data->>'earnedUSD'`,
        ])
        .where(`${metricWalletRegistryTableName}.period`, RegistryPeriod.Day)
        .whereBetween(`${metricWalletRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              wallet: string;
              stakingUSDDayBefore: string;
              earnedUSDDayBefore: string;
            }>,
          ) =>
            new Map(
              rows.map(({ wallet, stakingUSDDayBefore, earnedUSDDayBefore }) => [
                wallet,
                {
                  stakingUSDDayBefore,
                  earnedUSDDayBefore,
                },
              ]),
            ),
        ),
    ]);

    return walletsId.map((id) => {
      const latest = latestMap.get(id) ?? {
        stakingUSD: '0',
        earnedUSD: '0',
      };
      const dayBefore = dayBeforeMap.get(id) ?? {
        stakingUSDDayBefore: '0',
        earnedUSDDayBefore: '0',
      };
      return { ...latest, ...dayBefore };
    });
  });

export const walletRegistryLoader = () =>
  new DataLoader<{ contract: string; wallet: string }, MetricWalletRegistry | null>(
    async (pairs: Readonly<Array<{ contract: string; wallet: string }>>) => {
      const map = await container.model
        .metricWalletRegistryTable()
        .where('period', RegistryPeriod.Latest)
        .where(function () {
          pairs.forEach(({ contract, wallet }) =>
            this.orWhere(function () {
              this.where({ contract, wallet });
            }),
          );
        })
        .then((rows) => new Map(rows.map((row) => [`${row.contract}:${row.wallet}`, row])));

      return pairs.map(({ contract, wallet }) => map.get(`${contract}:${wallet}`) ?? null);
    },
  );

export const walletTokenLastMetricLoader = (filter: {
  tokenAlias?: { id?: string[]; liquidity?: TokenAliasLiquidity[] };
  contract?: string[];
}) =>
  new DataLoader<
    string,
    {
      wallet: string;
      balance: string;
      usd: string;
      usdDayBefore: string;
    }
  >(async (walletsId: ReadonlyArray<string>) => {
    const select = container.model
      .metricWalletTokenRegistryTable()
      .column(`${metricWalletTokenRegistryTableName}.wallet`)
      .innerJoin(
        tokenTableName,
        `${metricWalletTokenRegistryTableName}.token`,
        `${tokenTableName}.id`,
      )
      .innerJoin(tokenAliasTableName, `${tokenTableName}.alias`, `${tokenAliasTableName}.id`)
      .whereIn(`${metricWalletTokenRegistryTableName}.wallet`, walletsId)
      .where(function () {
        if (Array.isArray(filter.contract)) {
          if (filter.contract.length > 0) {
            this.whereIn(`${metricWalletTokenRegistryTableName}.contract`, filter.contract);
          } else {
            this.whereNull(`${metricWalletTokenRegistryTableName}.contract`);
          }
        }
        if (filter.tokenAlias) {
          if (Array.isArray(filter.tokenAlias.id)) {
            this.whereIn(`${tokenAliasTableName}.id`, filter.tokenAlias.id);
          }
          if (Array.isArray(filter.tokenAlias.liquidity)) {
            this.whereIn(`${tokenAliasTableName}.liquidity`, filter.tokenAlias.liquidity);
          }
        }
      })
      .groupBy(`${metricWalletTokenRegistryTableName}.wallet`);

    const [latestMap, dayBeforeMap] = await Promise.all([
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'usd',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .modify(QueryModify.sumMetric, [
          'balance',
          `${metricWalletTokenRegistryTableName}.data->>'balance'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Latest)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().add(1, 'day').startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              wallet: string;
              balance: string;
              usd: string;
            }>,
          ) =>
            new Map(
              rows.map(({ wallet, balance, usd }) => [
                wallet,
                {
                  wallet,
                  balance,
                  usd,
                },
              ]),
            ),
        ),
      select
        .clone()
        .modify(QueryModify.sumMetric, [
          'usdDayBefore',
          `${metricWalletTokenRegistryTableName}.data->>'usd'`,
        ])
        .where(`${metricWalletTokenRegistryTableName}.period`, RegistryPeriod.Day)
        .whereBetween(`${metricWalletTokenRegistryTableName}.date`, [
          dayjs().add(-1, 'day').startOf('day').toDate(),
          dayjs().startOf('day').toDate(),
        ])
        .then(
          (
            rows: Array<{
              wallet: string;
              usdDayBefore: string;
            }>,
          ) =>
            new Map(
              rows.map(({ wallet, usdDayBefore }) => [
                wallet,
                {
                  wallet,
                  usdDayBefore,
                },
              ]),
            ),
        ),
    ]);

    return walletsId.map((id) => {
      const latest = latestMap.get(id) ?? {
        wallet: id,
        balance: '0',
        usd: '0',
      };
      const dayBefore = dayBeforeMap.get(id) ?? {
        wallet: id,
        usdDayBefore: '0',
      };
      return { ...latest, ...dayBefore };
    });
  });

export const walletTriggersCountLoader = () =>
  new DataLoader<string, number>(async (walletsId) => {
    const map = await container.model
      .automateTriggerTable()
      .column({ wallet: `${walletTableName}.id` })
      .count({ count: `${triggerTableName}.id` })
      .innerJoin(walletTableName, `${triggerTableName}.wallet`, `${walletTableName}.id`)
      .whereIn('wallet', walletsId)
      .groupBy(`${walletTableName}.id`)
      .then((rows) => new Map(rows.map(({ wallet, count }) => [wallet, Number(count)])));

    return walletsId.map((id) => map.get(id) ?? 0);
  });

export const walletAutomatesLoader = () =>
  new DataLoader<string, Array<Wallet & WalletBlockchain>>(async (walletsId) => {
    const walletsMap = await container.model
      .walletTable()
      .innerJoin(
        walletBlockchainTableName,
        `${walletBlockchainTableName}.id`,
        `${walletTableName}.id`,
      )
      .columns(`${walletTableName}.*`)
      .columns(`${walletBlockchainTableName}.*`)
      .column({ ownerWallet: `${contractTableName}.wallet` })
      .innerJoin(contractTableName, `${walletTableName}.id`, `${contractTableName}.contractWallet`)
      .whereIn(`${contractTableName}.wallet`, walletsId)
      .whereNull(`${contractTableName}.archivedAt`)
      .then((rows) =>
        rows.reduce<Map<string, Array<Wallet & WalletBlockchain>>>(
          (map, wallet: Wallet & WalletBlockchain & { ownerWallet: string }) => {
            return map.set(wallet.ownerWallet, [...(map.get(wallet.ownerWallet) ?? []), wallet]);
          },
          new Map(),
        ),
      );

    return walletsId.map((id) => walletsMap.get(id) ?? []);
  });
