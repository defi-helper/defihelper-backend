import container from '@container';
import Knex from 'knex';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
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

  public readonly onContractCreated = new Emitter<MetricContract>(async (metric) => {
    container.model.queueService().push('eventsMetricContractCreated', {
      id: metric.id,
    });
  });

  constructor(
    readonly database: Factory<Knex>,
    readonly metricBlockchainTable: Factory<MetricBlockchainTable>,
    readonly metricProtocolTable: Factory<MetricProtocolTable>,
    readonly metricContractTable: Factory<MetricContractTable>,
    readonly metricContractTaskTable: Factory<MetricContractTaskTable>,
    readonly metricWalletTable: Factory<MetricWalletTable>,
    readonly metricWalletRegistryTable: Factory<MetricWalletRegistryTable>,
    readonly metricContractRegistryTable: Factory<MetricWalletRegistryTable>,
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

    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricContractTable().insert(created).transacting(trx),
        this.updateContractRegistry(created, trx),
      ]),
    );

    this.onContractCreated.emit(created);

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
    const created: MetricWallet = {
      id: uuid(),
      contract: contract.id,
      wallet: wallet.id,
      data,
      date,
      createdAt: new Date(),
    };
    await this.database().transaction(async (trx) =>
      Promise.all([
        this.metricWalletTable().insert(created).transacting(trx),
        this.updateWalletRegistry(created, trx),
      ]),
    );

    this.onWalletCreated.emit(created);

    return created;
  }

  async updateWalletRegistry(metric: MetricWallet, trx?: Knex.Transaction<any, any>) {
    const [dayBefore, weekBefore, monthBefore] = await Promise.all([
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'day').toDate(),
          dayjs(metric.date).add(-1, 'day').toDate(),
        ])
        .first(),
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'week').toDate(),
          dayjs(metric.date).add(-1, 'week').toDate(),
        ])
        .first(),
      this.metricWalletTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'month').toDate(),
          dayjs(metric.date).add(-1, 'month').toDate(),
        ])
        .first(),
    ]);
    const duplicate = await this.metricWalletRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
      })
      .first();
    const data = {
      ...metric.data,
      stakingUSDDayBefore: dayBefore?.data.stakingUSD ?? '0',
      stakingUSDWeekBefore: weekBefore?.data.stakingUSD ?? '0',
      stakingUSDMonthBefore: monthBefore?.data.stakingUSD ?? '0',
      earnedUSDDayBefore: dayBefore?.data.earnedUSD ?? '0',
      earnedUSDWeekBefore: weekBefore?.data.earnedUSD ?? '0',
      earnedUSDMonthBefore: monthBefore?.data.earnedUSD ?? '0',
    };
    if (!duplicate) {
      const query = this.metricWalletRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          data,
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
          data,
          date: metric.date,
        })
        .where('id', duplicate.id);
      if (trx) query.transacting(trx);
      return query;
    }
    return null;
  }

  async updateContractRegistry(metric: MetricContract, trx?: Knex.Transaction<any, any>) {
    const duplicate = await this.metricWalletRegistryTable()
      .where({
        contract: metric.contract,
      })
      .first();
    if (!duplicate) {
      const query = this.metricContractRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          data: metric.data,
          date: metric.date,
        })
        .onConflict(['contract'])
        .ignore();
      if (trx) query.transacting(trx);
      return query;
    }
    if (duplicate.date < metric.date) {
      const query = this.metricContractRegistryTable()
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
    const created: MetricWalletToken = {
      id: uuid(),
      contract: contract ? contract.id : null,
      wallet: wallet.id,
      token: token.id,
      data,
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
    const [dayBefore, weekBefore, monthBefore] = await Promise.all([
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'day').toDate(),
          dayjs(metric.date).add(-1, 'day').toDate(),
        ])
        .first(),
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'week').toDate(),
          dayjs(metric.date).add(-1, 'week').toDate(),
        ])
        .first(),
      this.metricWalletTokenTable()
        .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
        .where({
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
        })
        .whereBetween('date', [
          dayjs(metric.date).add(-2, 'month').toDate(),
          dayjs(metric.date).add(-1, 'month').toDate(),
        ])
        .first(),
    ]);
    const duplicate = await this.metricWalletTokenRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        token: metric.token,
      })
      .first();
    const data = {
      ...metric.data,
      usdDayBefore: dayBefore?.data.usd ?? '0',
      usdWeekBefore: weekBefore?.data.usd ?? '0',
      usdMonthBefore: monthBefore?.data.usd ?? '0',
    };
    if (!duplicate) {
      const query = this.metricWalletTokenRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
          data,
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
          data,
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
