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
  MetricContractRegistryTable,
  UserCollectorTable,
  UserCollector,
  UserCollectorStatus,
  MetricTokenRegistryTable,
  RegistryPeriod,
  MetricContractRegistry,
  MetricTokenRegistry,
  MetricWalletRegistry,
  MetricWalletTokenRegistry,
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
    readonly metricContractRegistryTable: Factory<MetricContractRegistryTable>,
    readonly metricTokenRegistryTable: Factory<MetricTokenRegistryTable>,
    readonly metricWalletTaskTable: Factory<MetricWalletTaskTable>,
    readonly metricWalletTokenTable: Factory<MetricWalletTokenTable>,
    readonly metricWalletTokenRegistryTable: Factory<MetricWalletTokenRegistryTable>,
    readonly metricTokenTable: Factory<MetricTokenTable>,
    readonly userCollectorTable: Factory<UserCollectorTable>,
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

    await this.database().transaction((trx) =>
      Promise.all([
        this.metricContractTable().insert(created).transacting(trx),
        this.updateContractRegistry(created, trx),
      ]),
    );
    this.onContractCreated.emit(created);

    return created;
  }

  async createContractRegistry(
    contractId: string,
    data: MetricMap,
    period: RegistryPeriod,
    date: Date,
    trx: Knex.Transaction<any, any>,
  ) {
    const created: MetricContractRegistry = {
      id: uuid(),
      contract: contractId,
      data,
      period,
      date,
    };
    await this.metricContractRegistryTable().insert(created).transacting(trx);

    return created;
  }

  cleanContractRegistry(period: RegistryPeriod, date: Date, trx: Knex.Transaction<any, any>) {
    return this.metricContractRegistryTable().where({ period, date }).delete().transacting(trx);
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

  async createWalletRegistry(
    contractId: string,
    walletId: string,
    data: MetricMap,
    period: RegistryPeriod,
    date: Date,
    trx: Knex.Transaction<any, any>,
  ) {
    const created: MetricWalletRegistry = {
      id: uuid(),
      contract: contractId,
      wallet: walletId,
      data,
      period,
      date,
    };
    await this.metricWalletRegistryTable().insert(created).transacting(trx);

    return created;
  }

  cleanWalletRegistry(period: RegistryPeriod, date: Date, trx: Knex.Transaction<any, any>) {
    return this.metricWalletRegistryTable().where({ period, date }).delete().transacting(trx);
  }

  async updateWalletRegistry(metric: MetricWallet, trx: Knex.Transaction<any, any>) {
    const dayBefore = await this.metricWalletTable()
      .modify(QueryModify.lastValue, ['contract', 'wallet'])
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
      })
      .whereBetween('date', [
        dayjs(metric.date).add(-2, 'day').startOf('day').toDate(),
        dayjs(metric.date).add(-1, 'day').startOf('day').toDate(),
      ])
      .first();
    const data = {
      ...metric.data,
      stakingUSDDayBefore: dayBefore?.data.stakingUSD ?? '0',
      earnedUSDDayBefore: dayBefore?.data.earnedUSD ?? '0',
    };
    const duplicate = await this.metricWalletRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        period: RegistryPeriod.Latest,
      })
      .first();
    if (!duplicate) {
      return this.metricWalletRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          data,
          period: RegistryPeriod.Latest,
          date: metric.date,
        })
        .transacting(trx);
    }
    if (duplicate.date < metric.date) {
      return this.metricWalletRegistryTable()
        .update({
          data: {
            ...duplicate.data,
            ...data,
            ...metric.data,
          },
          date: metric.date,
        })
        .where('id', duplicate.id)
        .transacting(trx);
    }
    return null;
  }

  async updateContractRegistry(metric: MetricContract, trx: Knex.Transaction<any, any>) {
    const duplicate = await this.metricContractRegistryTable()
      .where({
        contract: metric.contract,
        period: RegistryPeriod.Latest,
      })
      .first();
    if (!duplicate) {
      return this.metricContractRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          data: metric.data,
          period: RegistryPeriod.Latest,
          date: metric.date,
        })
        .transacting(trx);
    }
    if (duplicate.date < metric.date) {
      return this.metricContractRegistryTable()
        .update({
          data: {
            ...duplicate.data,
            ...metric.data,
          },
          date: metric.date,
        })
        .where('id', duplicate.id)
        .transacting(trx);
    }
    return null;
  }

  async updateTokenRegistry(metric: MetricToken, trx: Knex.Transaction<any, any>) {
    const duplicate = await this.metricTokenRegistryTable()
      .where({
        token: metric.token,
        period: RegistryPeriod.Latest,
      })
      .first();
    if (!duplicate) {
      return this.metricTokenRegistryTable()
        .insert({
          id: uuid(),
          token: metric.token,
          data: metric.data,
          period: RegistryPeriod.Latest,
          date: metric.date,
        })
        .transacting(trx);
    }
    if (duplicate.date < metric.date) {
      return this.metricTokenRegistryTable()
        .update({
          data: {
            ...duplicate.data,
            ...metric.data,
          },
          date: metric.date,
        })
        .where('id', duplicate.id)
        .transacting(trx);
    }
    return null;
  }

  async setWalletTask(contractId: string, walletId: string, taskId: string) {
    const duplicate = await this.metricWalletTaskTable()
      .where({ contract: contractId, wallet: walletId })
      .first();
    if (duplicate) {
      const updated: MetricWalletTask = {
        ...duplicate,
        task: taskId,
        createdAt: new Date(),
      };
      await this.metricWalletTaskTable().where('id', updated.id).update(updated);

      return updated;
    }

    const created: MetricWalletTask = {
      id: uuid(),
      contract: contractId,
      wallet: walletId,
      task: taskId,
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

  async createWalletTokenRegistry(
    contractId: string | null,
    walletId: string,
    tokenId: string,
    data: MetricMap,
    period: RegistryPeriod,
    date: Date,
    trx: Knex.Transaction<any, any>,
  ) {
    const created: MetricWalletTokenRegistry = {
      id: uuid(),
      contract: contractId,
      wallet: walletId,
      token: tokenId,
      data,
      period,
      date,
    };
    await this.metricWalletTokenRegistryTable().insert(created).transacting(trx);

    return created;
  }

  cleanWalletTokenRegistry(period: RegistryPeriod, date: Date, trx: Knex.Transaction<any, any>) {
    return this.metricWalletTokenRegistryTable().where({ period, date }).delete().transacting(trx);
  }

  async updateWalletTokenRegistry(metric: MetricWalletToken, trx: Knex.Transaction<any, any>) {
    const dayBefore = await this.metricWalletTokenTable()
      .modify(QueryModify.lastValue, ['contract', 'wallet', 'token'])
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        token: metric.token,
      })
      .whereBetween('date', [
        dayjs(metric.date).add(-2, 'day').startOf('day').toDate(),
        dayjs(metric.date).add(-1, 'day').startOf('day').toDate(),
      ])
      .first();

    const data = {
      ...metric.data,
      usdDayBefore: dayBefore?.data.usd ?? '0',
    };
    const duplicate = await this.metricWalletTokenRegistryTable()
      .where({
        contract: metric.contract,
        wallet: metric.wallet,
        token: metric.token,
        period: RegistryPeriod.Latest,
      })
      .first();
    if (!duplicate) {
      return this.metricWalletTokenRegistryTable()
        .insert({
          id: uuid(),
          contract: metric.contract,
          wallet: metric.wallet,
          token: metric.token,
          data,
          period: RegistryPeriod.Latest,
          date: metric.date,
        })
        .transacting(trx);
    }
    if (duplicate.date < metric.date) {
      return this.metricWalletTokenRegistryTable()
        .update({
          data: {
            ...duplicate.data,
            ...data,
            ...metric.data,
          },
          date: metric.date,
        })
        .where('id', duplicate.id)
        .transacting(trx);
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

    await this.database().transaction((trx) =>
      Promise.all([
        this.metricTokenTable().insert(created).transacting(trx),
        this.updateTokenRegistry(created, trx),
      ]),
    );

    return created;
  }

  async createTokenRegistry(
    tokenId: string,
    data: MetricMap,
    period: RegistryPeriod,
    date: Date,
    trx: Knex.Transaction<any, any>,
  ) {
    const created: MetricTokenRegistry = {
      id: uuid(),
      token: tokenId,
      data,
      period,
      date,
    };
    await this.metricTokenRegistryTable().insert(created).transacting(trx);

    return created;
  }

  cleanTokenRegistry(period: RegistryPeriod, date: Date, trx: Knex.Transaction<any, any>) {
    return this.metricTokenRegistryTable().where({ period, date }).delete().transacting(trx);
  }

  async createUserCollector(userId: string, tasks: string[]) {
    const created: UserCollector = {
      id: uuid(),
      user: userId,
      data: { tasks },
      status: UserCollectorStatus.Pending,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    await this.userCollectorTable().insert(created);

    return created;
  }

  async doneUserCollector(collector: UserCollector) {
    const updated: UserCollector = {
      ...collector,
      status: UserCollectorStatus.Done,
      updatedAt: new Date(),
    };
    await this.userCollectorTable().update(updated).where('id', collector.id);

    return updated;
  }
}
