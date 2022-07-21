import container from '@container';
import Knex from 'knex';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import BN from 'bignumber.js';
import { Blockchain } from '@models/types';
import { Emitter } from '@services/Event';
import { Protocol, Contract } from '@models/Protocol/Entity';
import { Factory } from '@services/Container';
import { Wallet } from '@models/Wallet/Entity';
import { Token } from '@models/Token/Entity';
import { Task } from '@models/Queue/Entity';
import {
  MetricBlockchain,
  MetricBlockchainTable,
  MetricContract,
  MetricContractTable,
  MetricContractTask,
  MetricContractTaskTable,
  MetricWalletTask,
  MetricWalletTaskTable,
  MetricMap,
  MetricProtocol,
  MetricProtocolTable,
  MetricToken,
  MetricTokenTable,
  MetricWallet,
  MetricWalletTable,
  MetricWalletToken,
  MetricWalletTokenTable,
  MetricWalletRegistryTable,
  MetricWalletTokenRegistryTable,
  QueryModify,
} from './Entity';

function calcChange(current: string, prev: string | undefined) {
  return prev && Number(prev) !== 0 ? new BN(current).div(prev).toFixed(8) : '0';
}

export class MetricContractService {
  public readonly onWalletCreated = new Emitter<MetricWallet>(async (metric) =>
    container.cache().publish(
      'defihelper:channel:onWalletMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
      }),
    ),
  );

  public readonly onWalletTokenCreated = new Emitter<MetricWalletToken>(async (metric) => {
    container.cache().publish(
      'defihelper:channel:onWalletTokenMetricUpdated',
      JSON.stringify({
        id: metric.id,
        wallet: metric.wallet,
        contract: metric.contract,
        token: metric.token,
      }),
    );
  });

  constructor(
    readonly database: Factory<Knex>,
    readonly metricBlockchainTable: Factory<MetricBlockchainTable>,
    readonly metricProtocolTable: Factory<MetricProtocolTable>,
    readonly metricContractTable: Factory<MetricContractTable>,
    readonly metricContractTaskTable: Factory<MetricContractTaskTable>,
    readonly metricWalletTable: Factory<MetricWalletTable>,
    readonly metricWalletRegistryTable: Factory<MetricWalletRegistryTable>,
    readonly metricWalletTaskTable: Factory<MetricWalletTaskTable>,
    readonly metricWalletTokenTable: Factory<MetricWalletTokenTable>,
    readonly metricWalletTokenRegistryTable: Factory<MetricWalletTokenRegistryTable>,
    readonly metricTokenTable: Factory<MetricTokenTable>,
  ) {}

  async createBlockchain(blockchain: Blockchain, network: string, data: MetricMap, date: Date) {
    const created: MetricBlockchain = {
      id: uuid(),
      blockchain,
      network,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricBlockchainTable().insert(created);

    return created;
  }

  async createProtocol(protocol: Protocol, data: MetricMap, date: Date) {
    const created: MetricProtocol = {
      id: uuid(),
      protocol: protocol.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricProtocolTable().insert(created);

    return created;
  }

  async createContract(contract: Contract, data: MetricMap, date: Date) {
    const created: MetricContract = {
      id: uuid(),
      contract: contract.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricContractTable().insert(created);

    return created;
  }

  async setContractTask(contract: Contract, task: Task) {
    const duplicate = await this.metricContractTaskTable().where('contract', contract.id).first();
    if (duplicate) {
      const updated: MetricContractTask = {
        ...duplicate,
        task: task.id,
        createdAt: new Date(),
      };
      await this.metricContractTaskTable().where('id', updated.id).update(updated);

      return updated;
    }

    const created: MetricContractTask = {
      id: uuid(),
      contract: contract.id,
      task: task.id,
      createdAt: new Date(),
    };
    await this.metricContractTaskTable().insert(created);

    return created;
  }

  async createWallet(contract: Contract, wallet: Wallet, data: MetricMap, date: Date) {
    const [dayBefore, weekBefore, monthBefore] = await Promise.all([
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: contract.id,
          wallet: wallet.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'day').toDate(),
          dayjs(date).add(-1, 'day').toDate(),
        ])
        .first(),
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: contract.id,
          wallet: wallet.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'week').toDate(),
          dayjs(date).add(-1, 'week').toDate(),
        ])
        .first(),
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: contract.id,
          wallet: wallet.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'month').toDate(),
          dayjs(date).add(-1, 'month').toDate(),
        ])
        .first(),
    ]);

    const created: MetricWallet = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      data: {
        ...data,
        stakingDailyChange: calcChange(data.staking, dayBefore?.data.staking),
        stakingWeeklyChange: calcChange(data.staking, weekBefore?.data.staking),
        stakingMonthlyChange: calcChange(data.staking, monthBefore?.data.staking),
        stakingUSDDailyChange: calcChange(data.stakingUSD, dayBefore?.data.stakingUSD),
        stakingUSDWeeklyChange: calcChange(data.stakingUSD, weekBefore?.data.stakingUSD),
        stakingUSDMonthlyChange: calcChange(data.stakingUSD, monthBefore?.data.stakingUSD),
        earnedDailyChange: calcChange(data.earned, dayBefore?.data.earned),
        earnedWeeklyChange: calcChange(data.earned, weekBefore?.data.earned),
        earnedMonthlyChange: calcChange(data.earned, monthBefore?.data.earned),
        earnedUSDDailyChange: calcChange(data.earnedUSD, dayBefore?.data.earnedUSD),
        earnedUSDWeeklyChange: calcChange(data.earnedUSD, weekBefore?.data.earnedUSD),
        earnedUSDMonthlyChange: calcChange(data.earnedUSD, monthBefore?.data.earnedUSD),
      },
      date,
      createdAt: new Date(),
    };
    const registryDuplicate = await this.metricWalletRegistryTable()
      .where({
        contract: created.contract,
        wallet: created.wallet,
      })
      .first();
    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricWalletTable().insert(created).transacting(trx),
        !registryDuplicate || registryDuplicate.date < date
          ? this.metricWalletRegistryTable()
              .insert({
                id: uuid(),
                contract: created.contract,
                wallet: created.wallet,
                data: created.data,
                date: created.date,
              })
              .onConflict(['contract', 'wallet'])
              .merge()
              .transacting(trx)
          : null,
      ]),
    );

    this.onWalletCreated.emit(created);

    return created;
  }

  async updateWalletRegistry(metric: MetricWallet, trx?: Knex.Transaction<any, any>) {
    const duplicate = await this.metricWalletRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
      })
      .first();
    if (!duplicate) {
      const query = this.metricWalletRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          data: metric.data,
          date: metric.date,
        })
        .onConflict(['contract', 'wallet'])
        .ignore();
      if (trx) query.transacting(trx);
      return query;
    }
    if (duplicate.date < metric.date) {
      const query = this.metricWalletRegistryTable()
        .update({
          data: metric.data,
          date: metric.date,
        })
        .where('id', duplicate.id);
      if (trx) query.transacting(trx);
      return query;
    }
    return null;
  }

  async setWalletTask(contract: Contract, wallet: Wallet, task: Task) {
    const duplicate = await this.metricWalletTaskTable()
      .where({ contract: contract.id, wallet: wallet.id })
      .first();
    if (duplicate) {
      const updated: MetricWalletTask = {
        ...duplicate,
        task: task.id,
        createdAt: new Date(),
      };
      await this.metricWalletTaskTable().where('id', updated.id).update(updated);

      return updated;
    }

    const created: MetricWalletTask = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      task: task.id,
      createdAt: new Date(),
    };
    await this.metricWalletTaskTable().insert(created);

    return created;
  }

  async createWalletToken(
    contract: Contract | null,
    wallet: Wallet,
    token: Token,
    data: MetricMap,
    date: Date,
  ) {
    const [dayBefore, weekBefore, monthBefore] = await Promise.all([
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: contract?.id ?? null,
          wallet: wallet.id,
          token: token.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'day').toDate(),
          dayjs(date).add(-1, 'day').toDate(),
        ])
        .first(),
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: contract?.id ?? null,
          wallet: wallet.id,
          token: token.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'week').toDate(),
          dayjs(date).add(-1, 'week').toDate(),
        ])
        .first(),
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: contract?.id ?? null,
          wallet: wallet.id,
          token: token.id,
        })
        .whereBetween('date', [
          dayjs(date).add(-2, 'month').toDate(),
          dayjs(date).add(-1, 'month').toDate(),
        ])
        .first(),
    ]);

    const created: MetricWalletToken = {
      id: uuid(),
      contract: contract ? contract.id : null,
      wallet: wallet.id,
      token: token.id,
      data: {
        ...data,
        balanceDailyChange: calcChange(data.balance, dayBefore?.data.balance),
        balanceWeeklyChange: calcChange(data.balance, weekBefore?.data.balance),
        balanceMonthlyChange: calcChange(data.balance, monthBefore?.data.balance),
        usdDailyChange: calcChange(data.usd, dayBefore?.data.usd),
        usdWeeklyChange: calcChange(data.usd, weekBefore?.data.usd),
        usdMonthlyChange: calcChange(data.usd, monthBefore?.data.usd),
      },
      date,
      createdAt: new Date(),
    };
    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricWalletTokenTable().insert(created).transacting(trx),
        this.updateWalletTokenRegistry(created, trx),
      ]),
    );

    this.onWalletTokenCreated.emit(created);

    return created;
  }

  async updateWalletTokenRegistry(metric: MetricWalletToken, trx?: Knex.Transaction<any, any>) {
    const duplicate = await this.metricWalletTokenRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        token: metric.token,
      })
      .first();
    if (!duplicate) {
      const query = this.metricWalletTokenRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
          data: metric.data,
          date: metric.date,
        })
        .onConflict(['contract', 'wallet', 'token'])
        .ignore();
      if (trx) query.transacting(trx);
      return query;
    }
    if (duplicate.date < metric.date) {
      const query = this.metricWalletTokenRegistryTable()
        .update({
          data: metric.data,
          date: metric.date,
        })
        .where('id', duplicate.id);
      if (trx) query.transacting(trx);
      return query;
    }
    return null;
  }

  async createToken(token: Token, data: MetricMap, date: Date) {
    const created: MetricToken = {
      id: uuid(),
      token: token.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.metricTokenTable().insert(created);

    return created;
  }
}
