import container from '@container';
import BN from 'bignumber.js';
import {
  metricWalletTableName,
  MetricWalletField,
  metricContractTableName,
  MetricContractAPRField,
  MetricWallet,
  metricWalletTokenTableName,
} from '@models/Metric/Entity';
import { walletContractLinkTableName } from '@models/Protocol/Entity';
import { Wallet, tableName as walletTableName } from '@models/Wallet/Entity';
import DataLoader from 'dataloader';
import { TokenAliasLiquidity, tokenAliasTableName, tokenTableName } from '@models/Token/Entity';

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
            .distinctOn(`${metricWalletTableName}.wallet`, `${metricWalletTableName}.contract`)
            .column(`${walletTableName}.user`)
            .column(database.raw(`(${metricWalletTableName}.data->>'${metric}')::numeric AS v`))
            .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTableName}.wallet`)
            .whereIn(`${walletTableName}.user`, usersId)
            .andWhere(database.raw(`${metricWalletTableName}.data->>'${metric}' IS NOT NULL`))
            .orderBy(`${metricWalletTableName}.wallet`)
            .orderBy(`${metricWalletTableName}.contract`)
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

export const userTokenLastMetricLoader = ({
  contract,
  tokenAlias,
}: {
  contract?: { id?: string[] } | null;
  tokenAlias?: { liquidity?: TokenAliasLiquidity[] };
}) =>
  new DataLoader(async (usersId: ReadonlyArray<string>) => {
    const database = container.database();
    let select = container.model
      .metricWalletTokenTable()
      .distinctOn(`${metricWalletTokenTableName}.wallet`, `${metricWalletTokenTableName}.token`)
      .column(`${walletTableName}.user`)
      .column(database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS v`))
      .innerJoin(walletTableName, `${walletTableName}.id`, `${metricWalletTokenTableName}.wallet`)
      .where(function () {
        this.whereIn(`${walletTableName}.user`, usersId).andWhere(
          database.raw(`${metricWalletTokenTableName}.data->>'usd' IS NOT NULL`),
        );
        if (typeof contract === 'object') {
          if (contract !== null) {
            if (Array.isArray(contract.id)) {
              this.whereIn(`${metricWalletTokenTableName}.contract`, contract.id);
            }
          } else {
            this.whereNull(`${metricWalletTokenTableName}.contract`);
          }
        }
      })
      .orderBy(`${metricWalletTokenTableName}.wallet`)
      .orderBy(`${metricWalletTokenTableName}.token`)
      .orderBy(`${metricWalletTokenTableName}.date`, 'DESC');
    if (typeof tokenAlias === 'object') {
      select = select
        .clone()
        .innerJoin(tokenTableName, `${tokenTableName}.id`, `${metricWalletTokenTableName}.token`)
        .innerJoin(tokenAliasTableName, `${tokenAliasTableName}.id`, `${tokenTableName}.alias`)
        .where(function () {
          if (Array.isArray(tokenAlias.liquidity) && tokenAlias.liquidity.length > 0) {
            this.whereIn(`${tokenAliasTableName}.liquidity`, tokenAlias.liquidity);
          }
        });
    }

    const map = new Map(
      await container
        .database()
        .column('user')
        .sum('v AS v')
        .from(select.clone().as('metric'))
        .groupBy('user')
        .then((rows) => rows.map(({ user, v }) => [user, v])),
    );

    return usersId.map((id) => map.get(id) ?? '0');
  });

export const walletLoader = () =>
  new DataLoader<string, Wallet | null>(async (walletsId) => {
    const map = new Map(
      await container.model
        .walletTable()
        .whereIn('id', walletsId)
        .then((rows) => rows.map((wallet) => [wallet.id, wallet])),
    );

    return walletsId.map((id) => map.get(id) ?? null);
  });

export const walletLastMetricLoader = () =>
  new DataLoader<string, MetricWallet | null>(async (walletsId: ReadonlyArray<string>) => {
    const map = new Map(
      await container.model
        .metricWalletTable()
        .distinctOn('wallet')
        .columns('*')
        .whereIn('wallet', walletsId)
        .orderBy('wallet')
        .orderBy('date', 'DESC')
        .then((rows) => rows.map((row) => [row.wallet, row])),
    );

    return walletsId.map((id) => map.get(id) ?? null);
  });

export const walletTokenLastMetricLoader = (filter: {
  tokenAlias?: { id?: string[]; liquidity?: TokenAliasLiquidity[] };
  contract?: string[];
}) =>
  new DataLoader<string, { wallet: string; balance: string; usd: string }>(
    async (walletsId: ReadonlyArray<string>) => {
      const database = container.database();
      const map = new Map(
        await container
          .database()
          .column('wallet')
          .sum('usd AS usd')
          .sum('balance AS balance')
          .from(
            container.model
              .metricWalletTokenTable()
              .distinctOn(
                `${metricWalletTokenTableName}.wallet`,
                `${metricWalletTokenTableName}.token`,
              )
              .column(`${metricWalletTokenTableName}.wallet`)
              .column(database.raw(`(${metricWalletTokenTableName}.data->>'usd')::numeric AS usd`))
              .column(
                database.raw(
                  `(${metricWalletTokenTableName}.data->>'balance')::numeric AS balance`,
                ),
              )
              .innerJoin(
                tokenTableName,
                `${metricWalletTokenTableName}.token`,
                `${tokenTableName}.id`,
              )
              .innerJoin(
                tokenAliasTableName,
                `${tokenTableName}.alias`,
                `${tokenAliasTableName}.id`,
              )
              .where(function () {
                this.whereIn(`${metricWalletTokenTableName}.wallet`, walletsId);
                if (Array.isArray(filter.contract)) {
                  if (filter.contract.length > 0) {
                    this.whereIn(`${metricWalletTokenTableName}.contract`, filter.contract);
                  } else {
                    this.whereNull(`${metricWalletTokenTableName}.contract`);
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
              .orderBy(`${metricWalletTokenTableName}.wallet`)
              .orderBy(`${metricWalletTokenTableName}.token`)
              .orderBy(`${metricWalletTokenTableName}.date`, 'DESC')
              .as('metric'),
          )
          .groupBy('wallet')
          .then((rows) =>
            rows.map(({ wallet, balance, usd }) => [wallet, { wallet, balance, usd }]),
          ),
      );

      return walletsId.map((id) => map.get(id) ?? { wallet: id, usd: '0', balance: '0' });
    },
  );
